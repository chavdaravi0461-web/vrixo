"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadRazorpayCheckout } from "@/lib/razorpay";
import { useCartStore } from "@/lib/store/cart-store";
import { checkoutSchema } from "@/lib/validations";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { buildOrderSuccessPath } from "@/lib/safe-navigation";
import type { ShippingSettings } from "@/lib/order-pricing";
import type { z } from "zod";

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutForm({
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
  const total = subtotal + shippingCharge - discount;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting }
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: "Cash on Delivery"
    }
  });
  const selectedPaymentMethod = useWatch({ control, name: "paymentMethod" });

  async function onCheckoutSubmit(values: CheckoutValues) {
    if (checkoutBusy || paymentBusy) return;

    const isOnlinePayment = values.paymentMethod === "Online Payment";
    const idempotencyKey = getCheckoutIdempotencyKey();

    if (!hasHydrated) {
      toast.error("Cart is still loading. Please try again.");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    if (!liveOrderReady) {
      toast.error("Checkout is temporarily unavailable. Please contact support.");
      return;
    }

    if (isOnlinePayment) {
      await startOnlinePayment(values, idempotencyKey);
      return;
    }

    setCheckoutBusy(true);
    const toastId = toast.loading("Placing your COD order...");

    try {
      const result = await postJson("/api/orders", {
        email: values.email,
        couponCode: values.couponCode || couponCode,
        paymentMethod: values.paymentMethod,
        shippingAddress: values,
        items,
        idempotencyKey
      }, 6500);
      const payload = result.payload;

      if (!result.ok || !payload.success || !payload.orderNumber) {
        if (payload.field) {
          setError(payload.field as keyof CheckoutValues, { message: String(payload.message ?? "Invalid value.") });
        }
        toast.error(String(payload.message ?? "Checkout failed. Please try again."), { id: toastId });
        return;
      }

      clearCart();
      toast.success("Order placed successfully. WhatsApp confirmation is being sent.", { id: toastId });
      redirectToOrderSuccess(String(payload.orderNumber), {
        paymentMethod: String(payload.paymentMethod ?? "cod"),
        orderStatus: String(payload.orderStatus ?? "pending"),
        paymentStatus: String(payload.paymentStatus ?? "cod_pending")
      });
    } catch {
      toast.error("Checkout failed. Please try again.", { id: toastId });
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function startOnlinePayment(values: CheckoutValues, idempotencyKey: string) {
    if (!razorpayReady) {
      toast.error("Online payment is temporarily unavailable. Please use Cash on Delivery.");
      return;
    }

    setPaymentBusy(true);

    try {
      const scriptLoaded = await loadRazorpayCheckout();

      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Payment gateway failed to load. Please try again.");
        return;
      }

      const createResult = await postJson("/api/payments/razorpay/create-order", {
        email: values.email,
        couponCode: values.couponCode || couponCode,
        shippingAddress: values,
        items,
        idempotencyKey
      }, 9000);
      const createPayload = createResult.payload;

      if (!createResult.ok) {
        toast.error(String(createPayload.message ?? "Payment not completed. Order was not placed."));
        return;
      }

      if (!createPayload.keyId || !createPayload.razorpayOrderId || !createPayload.amount) {
        toast.error("Online payment is temporarily unavailable. Please use Cash on Delivery.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: createPayload.keyId,
        amount: createPayload.amount,
        currency: createPayload.currency,
        name: "Vrixo",
        description: "Secure online payment for your order",
        order_id: createPayload.razorpayOrderId,
        prefill: createPayload.customer,
        config: {
          display: {
            blocks: {
              upiApps: {
                name: "Pay with UPI Apps",
                instruments: [{ method: "upi" }]
              }
            },
            sequence: ["block.upiApps", "card", "netbanking", "wallet"],
            preferences: { show_default_blocks: true }
          }
        },
        handler: async (paymentResponse: Record<string, unknown>) => {
          const verifyToastId = toast.loading("Verifying payment...");
          try {
            const verifyResult = await postJson("/api/payments/razorpay/verify", {
              email: values.email,
              couponCode: values.couponCode || couponCode,
              shippingAddress: values,
              items,
              internalOrderId: String(createPayload.orderId ?? ""),
              checkoutToken: String(createPayload.checkoutToken ?? ""),
              razorpayOrderId: String(paymentResponse.razorpay_order_id ?? ""),
              razorpayPaymentId: String(paymentResponse.razorpay_payment_id ?? ""),
              razorpaySignature: String(paymentResponse.razorpay_signature ?? "")
            }, 9000);
            const verifyPayload = verifyResult.payload;

            if (!verifyResult.ok || !verifyPayload.orderNumber || String(verifyPayload.paymentStatus).toLowerCase() !== "paid") {
              toast.error(String(verifyPayload.message ?? "Payment verification failed. Order was not placed."), { id: verifyToastId });
              return;
            }

            clearCart();
            toast.success("Online payment completed successfully. WhatsApp confirmation is being sent.", { id: verifyToastId });
            redirectToOrderSuccess(String(verifyPayload.orderNumber), {
              paymentMethod: String(verifyPayload.paymentMethod ?? "online"),
              orderStatus: String(verifyPayload.orderStatus ?? "confirmed"),
              paymentStatus: String(verifyPayload.paymentStatus ?? "paid"),
              verifiedPayment: "1"
            });
          } finally {
            setPaymentBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentBusy(false);
            toast.error("Payment not completed. Order was not placed.");
          }
        },
        theme: { color: "#0f766e" }
      });

      razorpay.on("payment.failed", () => {
        toast.error("Payment not completed. Order was not placed.");
        setPaymentBusy(false);
      });

      razorpay.open();
    } catch {
      toast.error("Payment could not be started. Please try again.");
      setPaymentBusy(false);
    }
  }

  return (
    <form
      className="dc-checkout-layout grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"
      onSubmit={handleSubmit(onCheckoutSubmit)}
    >
      <div className="dc-checkout-address dc-glass rounded-[var(--dc-radius-lg)] p-5">
        <h2 className="text-xl font-black uppercase tracking-[0.08em] text-[var(--dc-heading)]">Delivery Address</h2>
        {!liveOrderReady ? (
          <div className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Checkout is temporarily unavailable. Please contact support for help placing your
            order.
          </div>
        ) : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Full name" error={errors.fullName?.message}>
            <Input {...register("fullName")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Postal code" error={errors.postalCode?.message}>
            <Input {...register("postalCode")} />
          </Field>
          <Field label="Address line 1" error={errors.line1?.message}>
            <Input {...register("line1")} />
          </Field>
          <Field label="Address line 2" error={errors.line2?.message}>
            <Input {...register("line2")} />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <Input {...register("city")} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <Input {...register("state")} />
          </Field>
          <Field label="Country" error={errors.country?.message}>
            <Input defaultValue="India" {...register("country")} />
          </Field>
        </div>
      </div>
      <div className="dc-checkout-summary dc-glass rounded-[var(--dc-radius-lg)] p-5 lg:sticky lg:top-32 lg:self-start">
        <h2 className="text-xl font-black uppercase tracking-[0.08em] text-[var(--dc-heading)]">Order Summary</h2>
        <div className="mt-6 space-y-3 text-sm text-[var(--dc-muted)]">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`}
              className="flex items-center justify-between gap-4"
            >
              <span>
                {cleanProductTitle(item.title)} x {item.quantity}
              </span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-[var(--dc-border)] pt-4">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Discount</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Shipping</span>
              <span>
                {shippingCharge === 0
                  ? "Free"
                  : formatCurrency(shippingCharge)}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--dc-muted)]">
              {shippingSettings.mode === "free"
                ? "Free delivery is active on every order."
                : `Manual shipping charge: ${formatCurrency(shippingSettings.shippingCharge)}.`}
            </p>
            <div className="mt-3">
              <Field label="Coupon code" error={errors.couponCode?.message}>
                <Input defaultValue={couponCode} {...register("couponCode")} />
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between text-lg font-black text-[var(--dc-heading)]">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--dc-muted)]">
            Payment method
          </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] p-4 transition hover:border-white">
              <input
                type="radio"
                name="paymentMethod"
                value="razorpay"
                defaultChecked
                className="mt-1 h-4 w-4 accent-white"
            />
            <div>
              <p className="font-bold text-[var(--dc-heading)]">Cash on Delivery</p>
              <p className="mt-1 text-sm text-[var(--dc-muted)]">
                Pay when your order reaches your doorstep.
              </p>
            </div>
          </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] p-4 transition hover:border-white">
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                className="mt-1 h-4 w-4 accent-white"
            />
            <div>
              <p className="font-bold text-[var(--dc-heading)]">Online Payment</p>
              <p className="mt-1 text-sm text-[var(--dc-muted)]">
                {razorpayReady
                  ? "Pay securely with Razorpay using UPI, cards, wallets, and netbanking."
                  : "Online payment is temporarily unavailable. Please use Cash on Delivery."}
              </p>
            </div>
          </label>
          {errors.paymentMethod ? (
            <p className="text-sm text-red-600">{errors.paymentMethod.message}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] bg-[var(--dc-surface-soft)] px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--dc-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--dc-primary)]" />
              Razorpay Secure
            </span>
            <span className="text-[var(--dc-muted-2)]">|</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--dc-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--dc-primary)]" />
              SSL Encrypted
            </span>
            <span className="text-[var(--dc-muted-2)]">|</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--dc-muted)]">
              <ExternalLink className="h-3.5 w-3.5 text-[var(--dc-primary)]" />
              UPI &bull; Cards &bull; Netbanking
            </span>
          </div>
        </div>
        <div className="mt-6 rounded-[var(--dc-radius-md)] border border-[#f3d7a0] bg-[var(--dc-surface)] p-4 text-sm text-[var(--dc-heading)]">
          Login is required before checkout. COD orders stay pending until Vrixo confirms and processes them.
        </div>
        <Button type="submit" className="mt-6 h-12 w-full rounded-full" disabled={isSubmitting || checkoutBusy || paymentBusy || !liveOrderReady}>
          {isSubmitting || checkoutBusy || paymentBusy
            ? "Processing..."
            : selectedPaymentMethod === "Online Payment"
              ? "Pay Online"
              : "Place COD Order"}
        </Button>
        <p className="mt-2 text-center text-xs text-[var(--dc-muted-2)]">
          Your information is secure. Payments powered by Razorpay.
        </p>
      </div>
    </form>
  );
}

async function postJson(url: string, body: Record<string, unknown>, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = getRequestId();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    return {
      ok: response.ok,
      payload: await safeJson(response)
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      payload: {
        message: aborted
          ? "Checkout is busy. Please try again."
          : "Checkout failed. Please check your connection and try again."
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return { message: response.ok ? "OK" : "Request failed." };
  }
}

function getRequestId() {
  return `web-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function getCheckoutIdempotencyKey() {
  const storageKey = "vrixo-checkout-idempotency-key";
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function redirectToOrderSuccess(
  orderNumber: string,
  params: Record<string, string | undefined>
) {
  try {
    window.sessionStorage.removeItem("vrixo-checkout-idempotency-key");
    window.location.assign(buildOrderSuccessPath(orderNumber, params));
  } catch {
    toast.error("Order placed, but redirect failed. Open My Orders to view your order.");
  }
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--dc-text)]">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}
