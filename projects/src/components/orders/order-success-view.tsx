"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, ArrowRight, Package, Truck, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { buildOrderTrackPath } from "@/lib/safe-navigation";
import type { OrderStatusView } from "@/lib/orders/order-status";

type OrderPayload = {
  id: string; orderNumber: string; total: number; paymentMethod: string | null;
  paymentStatus: string | null; orderStatus: string | null; razorpayPaymentId: string | null;
  createdAt: string | null; customerPhone: string | null; customerName: string | null;
  shippingAddress: unknown; items: unknown; whatsappStatus: string | null; whatsappError: string | null;
  statusView: OrderStatusView;
};

type Props = {
  orderNumber: string; initialOrder: OrderPayload | null; initialError: string | null;
  productImageUrl: string; productName: string; totalQuantity: number; deliveryAddress: string;
  trackingSteps: Array<{ title: string; date: string; description: string; time: string; active: boolean }>;
};

export function OrderSuccessView({ orderNumber, initialOrder, initialError, productImageUrl, productName, totalQuantity, deliveryAddress, trackingSteps }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(!initialOrder && !initialError);
  const [retryingWhatsApp, setRetryingWhatsApp] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const refreshOrder = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { order?: OrderPayload; message?: string } | null;
      if (!res.ok || !payload?.order) throw new Error(payload?.message ?? "Order not found yet.");
      setOrder(payload.order);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your order."); }
    finally { setLoading(false); }
  }, [orderNumber]);

  useEffect(() => { if (!initialOrder && !initialError) { const t = setTimeout(() => { void refreshOrder(); }, 0); return () => clearTimeout(t); } }, [initialOrder, initialError, refreshOrder]);

  async function retryWhatsApp() {
    setRetryingWhatsApp(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/whatsapp`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { sent?: boolean; message?: string; error?: string } | null;
      if (!res.ok) throw new Error(payload?.message ?? payload?.error ?? "WhatsApp retry failed.");
      await refreshOrder();
    } catch (e) { setError(e instanceof Error ? e.message : "WhatsApp retry failed."); }
    finally { setRetryingWhatsApp(false); }
  }

  if (loading) {
    return (
      <section className="section" style={{ paddingTop: "60px" }}>
        <div className="container">
          <div className="flex flex-col items-center justify-center py-20 text-center anim-fade-in">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="display-md" style={{ marginTop: "20px", letterSpacing: "-.02em" }}>Confirming your order</p>
            <p className="body-sm" style={{ marginTop: "8px" }}>Please wait while we load order {orderNumber}...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="section" style={{ paddingTop: "60px" }}>
        <div className="container">
          <div className="glass-card" style={{ maxWidth: "480px", margin: "0 auto", padding: "40px", textAlign: "center" }}>
            <div className="eyebrow">Order lookup pending</div>
            <h2 className="display-md" style={{ marginTop: "12px" }}>We are syncing your order</h2>
            <p className="body-sm" style={{ marginTop: "8px" }}>{error ?? "Order details are still being saved."}</p>
            <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: "24px" }}>
              <button type="button" className="hero-btn hero-btn-primary" onClick={() => void refreshOrder()}>
                <RefreshCw className="h-4 w-4" /> Retry now
              </button>
              <Link href="/my-orders" className="hero-btn hero-btn-ghost">View my orders</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const status = order.statusView;

  return (
    <section className="section" style={{ paddingTop: "40px" }}>
      <div className="container" style={{ maxWidth: "680px" }}>
        {/* Celebration header */}
        <div className={`text-center anim-fade-up ${mounted ? "" : ""}`} style={{ animationDelay: "0.1s" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border)", marginBottom: "20px" }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: "var(--accent)" }} />
          </div>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>{status.isPendingState ? "Order Placed" : "Order Confirmed"}</p>
          <h1 className="display-lg" style={{ marginTop: "8px" }}>Thank you</h1>
          <p className="body" style={{ marginTop: "8px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
            Your order <span className="mono" style={{ color: "var(--accent)" }}>{order.orderNumber}</span> has been saved.
            {status.isOnlinePayment ? (status.isPaidOnlinePayment ? " Payment is verified." : " We are confirming your payment.") : status.isCodPending ? " Cash on Delivery selected." : " Our team will process it shortly."}
          </p>
        </div>

        {/* Status bar */}
        <div className="glass-card anim-fade-up" style={{ padding: "20px", marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
          {[
            { label: "Payment", value: status.displayPaymentMethod },
            { label: "Status", value: status.displayPaymentStatus },
            { label: "Order", value: status.displayOrderStatus },
            { label: "Total", value: formatCurrency(order.total) },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <p className="mono" style={{ color: "var(--text-muted)", marginBottom: "4px" }}>{s.label}</p>
              <p className="body-sm" style={{ fontWeight: 500, color: "var(--text)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="glass-card anim-fade-up" style={{ padding: "24px", marginTop: "16px", display: "grid", gap: "20px", gridTemplateColumns: "1fr 120px" }}>
          <div>
            <p className="body-sm" style={{ fontWeight: 500, color: "var(--text)", marginBottom: "8px" }}>Order summary</p>
            <p className="body-sm">{productName}</p>
            <p className="body-sm" style={{ marginTop: "4px" }}>Quantity: {totalQuantity}</p>
            <p className="body-sm" style={{ marginTop: "4px" }}>Contact: {order.customerPhone || "Not provided"}</p>
            <p className="body-sm" style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin className="h-3 w-3 shrink-0" /> {deliveryAddress}
            </p>
          </div>
          <div style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--bg-card)" }}>
            <Image src={productImageUrl} alt={productName} width={120} height={160} className="object-cover w-full h-full" style={{ aspectRatio: "3/4" }} />
          </div>
        </div>

        {/* Tracking timeline */}
        <div className="glass-card anim-fade-up" style={{ padding: "24px", marginTop: "16px", animationDelay: "0.2s" }}>
          <h2 className="display-md" style={{ fontSize: "16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Truck className="h-4 w-4" style={{ color: "var(--accent)" }} /> Shipping timeline
          </h2>
          <div>
            {trackingSteps.map((step, index) => (
              <div key={step.title} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: "16px", position: "relative" }}>
                {index < trackingSteps.length - 1 && (
                  <div style={{ position: "absolute", left: "11px", top: "24px", bottom: "0", width: "2px", background: step.active ? "var(--accent)" : "var(--border)" }} />
                )}
                <div style={{ display: "flex", alignItems: "flex-start", paddingTop: "2px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${step.active ? "var(--accent)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", background: step.active ? "var(--accent)" : "transparent", transition: "all .4s ease" }}>
                    {step.active && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--bg)" }} />}
                  </div>
                </div>
                <div style={{ paddingBottom: index < trackingSteps.length - 1 ? "24px" : "0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: step.active ? "var(--text)" : "var(--text-muted)" }}>{step.title}</p>
                    <span className="mono" style={{ color: "var(--text-muted)", fontSize: "11px" }}>{step.date}</span>
                  </div>
                  <p className="body-sm" style={{ marginTop: "4px", color: step.active ? "var(--text-secondary)" : "var(--text-muted)" }}>{step.description}</p>
                  <p className="body-sm" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp + Actions */}
        <div className="anim-fade-up" style={{ marginTop: "24px" }}>
          {order.whatsappStatus && order.whatsappStatus !== "failed" ? (
            <div className="glass-card" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <MessageCircle className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <span className="body-sm" style={{ color: "var(--text-secondary)" }}>Order details sent to WhatsApp</span>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="body-sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                WhatsApp confirmation pending{order.whatsappError ? `: ${order.whatsappError}` : "."}
              </p>
              <button type="button" className="hero-btn hero-btn-ghost" disabled={retryingWhatsApp} onClick={() => void retryWhatsApp()}>
                {retryingWhatsApp ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : "Resend WhatsApp"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: "16px" }}>
            <Link href={buildOrderTrackPath(order.orderNumber)} className="hero-btn hero-btn-primary">
              Track order <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/my-orders" className="hero-btn hero-btn-ghost">View my orders</Link>
            <Link href="/shop" className="hero-btn hero-btn-ghost">Continue shopping</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
