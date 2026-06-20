"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadRazorpayCheckout } from "@/lib/razorpay";
import { useCartStore } from "@/lib/store/cart-store";
import { checkoutSchema } from "@/lib/validations";
import { usePincodeLookup } from "@/lib/use-pincode-lookup";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { buildOrderSuccessPath } from "@/lib/safe-navigation";
import type { ShippingSettings } from "@/lib/order-pricing";
import type { z } from "zod";

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutForm({
  userId,
  liveOrderReady,
  onlinePaymentReady,
  shippingSettings
}: {
  userId?: string | null;
  liveOrderReady: boolean;
  onlinePaymentReady: boolean;
  shippingSettings: ShippingSettings;
}) {
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const couponCode = useCartStore((state) => state.couponCode);
  const discount = useCartStore((state) => state.discount);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const razorpayReady = liveOrderReady && onlinePaymentReady;

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const shippingCharge = calculateShippingCharge(subtotal, items, shippingSettings);
  const total = Math.max(0, subtotal + shippingCharge - discount);

  const { register, handleSubmit, setError, setValue, control, formState: { errors, isSubmitting } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { paymentMethod: "Cash on Delivery", country: "India" }
  });
  const selectedPaymentMethod = useWatch({ control, name: "paymentMethod" });
  const [postalCode, setPostalCode] = useState("");
  const { ref: postalRef } = register("postalCode");
  const { loading: pincodeLoading, error: pincodeError, result: pincodeResult } = usePincodeLookup(postalCode, { debounceMs: 350 });

  useEffect(() => {
    if (pincodeResult) {
      try {
        setValue("city", pincodeResult.city || "");
        setValue("state", pincodeResult.state || "");
        setValue("country", pincodeResult.country || "India");
      } catch {}
    } else if (postalCode.length === 6 && !pincodeLoading) {
      // when 6 digits entered but not found, clear fields
      setValue("city", "");
      setValue("state", "");
      setValue("country", "");
    }
    if (pincodeError) {
      setError("postalCode", { message: typeof pincodeError === "string" ? pincodeError : "Invalid pincode." });
    }
  }, [pincodeResult, pincodeError, postalCode, pincodeLoading, setValue, setError]);

  async function onCheckoutSubmit(values: CheckoutValues) {
    if (checkoutBusy || paymentBusy) return;
    // Ensure valid pincode resolved before proceeding
    if (!/^[0-9]{6}$/.test(values.postalCode || "") || !pincodeResult) {
      setError("postalCode", { message: "Enter a valid 6-digit pincode and wait for lookup." });
      toast.error("Please enter a valid pincode before continuing.");
      return;
    }
    const isOnlinePayment = values.paymentMethod === "Online Payment";
    const idempotencyKey = getCheckoutIdempotencyKey();
    if (!hasHydrated) { toast.error("Cart is still loading. Please try again."); return; }
    if (items.length === 0) { toast.error("Your cart is empty."); return; }
    if (!liveOrderReady) { toast.error("Checkout is temporarily unavailable. Please contact support."); return; }
    if (isOnlinePayment) { await startOnlinePayment(values, idempotencyKey); return; }

    setCheckoutBusy(true);
    const toastId = toast.loading("Placing your COD order...");
    try {
      const result = await postJson("/api/orders", {
        email: values.email, couponCode: values.couponCode || couponCode,
        paymentMethod: values.paymentMethod,
        shippingAddress: { fullName: values.fullName, phone: values.phone, line1: values.line1, line2: values.line2, city: values.city, state: values.state, postalCode: values.postalCode, country: values.country },
        items, idempotencyKey
      }, 20000);
      const payload = result.payload;
      if (!result.ok || !payload.success || !payload.orderNumber) {
        if (payload.field) setError(payload.field as keyof CheckoutValues, { message: String(payload.message ?? "Invalid value.") });
        const msg = String(payload.message ?? "Checkout failed. Please try again.");
        if (msg.includes("busy")) {
          toast.error("Server is starting up. Please try again in a moment.", { id: toastId });
        } else {
          toast.error(msg, { id: toastId });
        }
        return;
      }
      clearCart();
      toast.success("Order placed successfully. WhatsApp confirmation is being sent.", { id: toastId });
      redirectToOrderSuccess(String(payload.orderNumber), {
        paymentMethod: String(payload.paymentMethod ?? "cod"),
        orderStatus: String(payload.orderStatus ?? "pending"),
        paymentStatus: String(payload.paymentStatus ?? "cod_pending")
      });
    } catch { toast.error("Checkout failed. Please try again.", { id: toastId }); }
    finally { setCheckoutBusy(false); }
  }

  async function startOnlinePayment(values: CheckoutValues, idempotencyKey: string) {
    if (!razorpayReady) { toast.error("Online payment is temporarily unavailable. Please use Cash on Delivery."); return; }
    setPaymentBusy(true);
    try {
      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) { toast.error("Payment gateway failed to load. Please try again."); return; }

      const createResult = await postJson("/api/payments/razorpay/create-order", {
        email: values.email, couponCode: values.couponCode || couponCode,
        shippingAddress: values, items, idempotencyKey
      }, 20000);
      const createPayload = createResult.payload;
      if (!createResult.ok) { toast.error(String(createPayload.message ?? "Payment not completed. Order was not placed.")); return; }
      if (!createPayload.keyId || !createPayload.razorpayOrderId || !createPayload.amount) { toast.error("Online payment is temporarily unavailable. Please use Cash on Delivery."); return; }

      const razorpay = new window.Razorpay({
        key: createPayload.keyId, amount: createPayload.amount, currency: createPayload.currency,
        name: "Vrixo", description: "Secure online payment for your order",
        order_id: createPayload.razorpayOrderId, prefill: createPayload.customer,
        config: {
          display: {
            blocks: { upiApps: { name: "Pay with UPI Apps", instruments: [{ method: "upi" }] } },
            sequence: ["block.upiApps", "card", "netbanking", "wallet"],
            preferences: { show_default_blocks: true }
          }
        },
        handler: async (paymentResponse: Record<string, unknown>) => {
          const verifyToastId = toast.loading("Verifying payment...");
          try {
            const verifyResult = await postJson("/api/payments/razorpay/verify", {
              email: values.email, couponCode: values.couponCode || couponCode,
              shippingAddress: values, items,
              internalOrderId: String(createPayload.orderId ?? ""),
              checkoutToken: String(createPayload.checkoutToken ?? ""),
              razorpayOrderId: String(paymentResponse.razorpay_order_id ?? ""),
              razorpayPaymentId: String(paymentResponse.razorpay_payment_id ?? ""),
              razorpaySignature: String(paymentResponse.razorpay_signature ?? "")
            }, 20000);
            const verifyPayload = verifyResult.payload;
            if (!verifyResult.ok || !verifyPayload.orderNumber || String(verifyPayload.paymentStatus).toLowerCase() !== "paid") {
              toast.error(String(verifyPayload.message ?? "Payment verification failed. Order was not placed."), { id: verifyToastId }); return;
            }
            clearCart();
            toast.success("Online payment completed successfully. WhatsApp confirmation is being sent.", { id: verifyToastId });
            redirectToOrderSuccess(String(verifyPayload.orderNumber), {
              paymentMethod: String(verifyPayload.paymentMethod ?? "online"),
              orderStatus: String(verifyPayload.orderStatus ?? "confirmed"),
              paymentStatus: String(verifyPayload.paymentStatus ?? "paid"),
              verifiedPayment: "1"
            });
          } finally { setPaymentBusy(false); }
        },
        modal: { ondismiss: () => { setPaymentBusy(false); toast.error("Payment not completed. Order was not placed."); } },
        theme: { color: "#F5F5F2" }
      });
      razorpay.on("payment.failed", () => { toast.error("Payment not completed. Order was not placed."); setPaymentBusy(false); });
      razorpay.open();
    } catch { toast.error("Payment could not be started. Please try again."); setPaymentBusy(false); }
  }

  return (
    <form className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit(onCheckoutSubmit)}>
      <div className="glass-card" style={{ padding: "24px" }}>
        <h2 className="display-md" style={{ fontSize: "16px", letterSpacing: "-.015em", textTransform: "uppercase" }}>Delivery Address</h2>
        {!liveOrderReady ? (
          <div className="body-sm" style={{ marginTop: "16px", padding: "12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
            Checkout is temporarily unavailable. Please contact support for help placing your order.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2" style={{ marginTop: "24px" }}>
          <Field label="Full name" error={errors.fullName?.message}><Input {...register("fullName")} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          <p className="body-sm" style={{ gridColumn: "1 / -1", marginTop: "-8px", color: "var(--text-muted)", fontSize: "12px" }}>
            A Vrixo account will be automatically created with this email. You can set a password later via "Forgot Password" on the login page.
          </p>
          <Field label="Phone" error={errors.phone?.message}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-muted)", fontSize: "13px", pointerEvents: "none", zIndex: 1 }}>+91</span>
              <Input {...register("phone")} style={{ paddingLeft: "36px" }} maxLength={10} inputMode="numeric" pattern="[0-9]*" />
            </div>
          </Field>
          <Field label="Postal code" error={errors.postalCode?.message}>
            <div style={{ position: "relative" }}>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={postalCode}
                onChange={(event) => {
                  const next = event.target.value.replace(/[^0-9]/g, "");
                  setPostalCode(next);
                  setValue("postalCode", next);
                }}
                onBlur={() => setValue("postalCode", postalCode)}
                ref={postalRef}
              />
              {pincodeLoading ? <span style={{ position: "absolute", right: 10, top: 10 }} className="body-sm">Loading...</span> : null}
              {!pincodeLoading && pincodeResult ? <span style={{ position: "absolute", right: 10, top: 10, color: "#16a34a", fontSize: "12px", fontWeight: 700 }}>OK</span> : null}
            </div>
          </Field>
          <Field label="Address line 1" error={errors.line1?.message} className="md:col-span-2"><Input {...register("line1")} /></Field>
          <Field label="Address line 2" error={errors.line2?.message} className="md:col-span-2"><Input {...register("line2")} /></Field>
          <Field label="City" error={errors.city?.message}>
            <Input {...register("city")} defaultValue={pincodeResult?.city ?? ""} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <Input {...register("state")} defaultValue={pincodeResult?.state ?? ""} />
          </Field>
          <Field label="Country" error={errors.country?.message}>
            <Input defaultValue={pincodeResult?.country ?? "India"} {...register("country")} />
          </Field>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "24px", position: "sticky", top: "96px", alignSelf: "start", height: "fit-content" }}>
        <h2 className="display-md" style={{ fontSize: "16px", letterSpacing: "-.015em", textTransform: "uppercase" }}>Order Summary</h2>
        <div className="body-sm" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "24px" }}>
          {items.map((item) => (
            <div key={`${item.productId}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`} className="flex items-center justify-between gap-4">
              <span>{cleanProductTitle(item.title)} x {item.quantity}</span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between" style={{ marginTop: "8px" }}><span>Discount</span><span>- {formatCurrency(discount)}</span></div>
            <div className="flex items-center justify-between" style={{ marginTop: "8px" }}><span>Shipping</span><span>{shippingCharge === 0 ? "Free" : formatCurrency(shippingCharge)}</span></div>
            <p className="body-sm" style={{ marginTop: "4px" }}>
              {shippingSettings.mode === "free" ? "Free delivery is active on every order." : `Manual shipping charge: ${formatCurrency(shippingSettings.shippingCharge)}.`}
            </p>
            <div style={{ marginTop: "12px" }}>
              <Field label="Coupon code" error={errors.couponCode?.message}>
                <Input defaultValue={couponCode} {...register("couponCode")} />
              </Field>
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: "16px", fontSize: "18px", fontWeight: 600, letterSpacing: "-.015em" }}>
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <p className="body-sm" style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "12px" }}>Payment method</p>
          <label className="payment-option" style={{ cursor: "pointer" }}>
            <input type="radio" value="Cash on Delivery" {...register("paymentMethod")} className="sr-only" />
            <div className="payment-radio" aria-hidden="true" />
            <div>
              <p style={{ fontWeight: 500, color: "var(--text)", fontSize: "13px" }}>Cash on Delivery</p>
              <p className="body-sm" style={{ marginTop: "4px" }}>Pay when your order reaches your doorstep.</p>
            </div>
          </label>
          <label className="payment-option" style={{ cursor: "pointer", marginTop: "8px" }}>
            <input type="radio" value="Online Payment" {...register("paymentMethod")} className="sr-only" />
            <div className="payment-radio" aria-hidden="true" />
            <div>
              <p style={{ fontWeight: 500, color: "var(--text)", fontSize: "13px" }}>Online Payment</p>
              <p className="body-sm" style={{ marginTop: "4px" }}>
                {razorpayReady ? "Pay securely with Razorpay using UPI, cards, wallets, and netbanking." : "Online payment is temporarily unavailable. Please use Cash on Delivery."}
              </p>
            </div>
          </label>
          {errors.paymentMethod ? <p className="body-sm" style={{ color: "rgba(255,80,80,.8)", marginTop: "4px" }}>{errors.paymentMethod.message}</p> : null}
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] px-4 py-3" style={{ border: "1px solid var(--border)", marginTop: "12px" }}>
            <span className="inline-flex items-center gap-1.5 body-sm"><ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> Razorpay Secure</span>
            <span style={{ color: "var(--text-muted)" }}>|</span>
            <span className="inline-flex items-center gap-1.5 body-sm"><ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> SSL Encrypted</span>
            <span style={{ color: "var(--text-muted)" }}>|</span>
            <span className="inline-flex items-center gap-1.5 body-sm"><ExternalLink className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> UPI &bull; Cards &bull; Netbanking</span>
          </div>
        </div>

        <div className="body-sm" style={{ marginTop: "16px", padding: "12px", borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", border: "1px solid var(--border)", lineHeight: 1.6 }}>
          COD orders stay pending until Vrixo confirms and processes them. All payments are secure and encrypted.
        </div>

        <Button type="submit" className="h-12 w-full" style={{ marginTop: "24px", borderRadius: "var(--radius-sm)" }} disabled={isSubmitting || checkoutBusy || paymentBusy || !liveOrderReady}>
          {isSubmitting || checkoutBusy || paymentBusy ? "Processing..." : selectedPaymentMethod === "Online Payment" ? "Pay Online" : "Place COD Order"}
        </Button>
        <p className="body-sm" style={{ textAlign: "center", marginTop: "8px" }}>Your information is secure. Payments powered by Razorpay.</p>
      </div>
    </form>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className} style={{ display: "block" }}>
      <span className="body-sm" style={{ display: "block", marginBottom: "6px", fontWeight: 500, color: "var(--text)" }}>{label}</span>
      {children}
      {error ? <span className="body-sm" style={{ display: "block", marginTop: "4px", color: "rgba(255,80,80,.8)" }}>{error}</span> : null}
    </label>
  );
}

async function postJson(url: string, body: Record<string, unknown>, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = getRequestId();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return { ok: response.ok, payload: await safeJson(response) };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, payload: { message: aborted ? "Checkout is busy. Please try again." : "Checkout failed. Please check your connection and try again." } };
  } finally { clearTimeout(timeout); }
}

async function safeJson(response: Response) { try { return (await response.json()) as Record<string, unknown>; } catch { return { message: response.ok ? "OK" : "Request failed." }; } }
function getRequestId() { return `web-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`; }
function getCheckoutIdempotencyKey() {
  const storageKey = "vrixo-checkout-idempotency-key";
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}
function redirectToOrderSuccess(orderNumber: string, params: Record<string, string | undefined>) {
  try { window.sessionStorage.removeItem("vrixo-checkout-idempotency-key"); window.location.assign(buildOrderSuccessPath(orderNumber, params)); }
  catch { toast.error("Order placed, but redirect failed. Open My Orders to view your order."); }
}
