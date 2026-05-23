import { CheckoutForm } from "@/components/store/checkout-form";
import { requireUser } from "@/lib/auth";
import { hasRazorpayServerEnv } from "@/lib/env/server";
import { buildMetadata } from "@/lib/metadata";
import { getShippingSettings } from "@/lib/shipping-settings";
import { isSupabaseConfigured } from "@/lib/utils";

export const metadata = {
  ...buildMetadata("Checkout"),
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const publicSupabaseConfigured = isSupabaseConfigured();
  const liveOrderReady = publicSupabaseConfigured;
  const onlinePaymentReady = liveOrderReady && hasRazorpayServerEnv();
  const user = await requireUser("/checkout");
  const shippingSettings = await getShippingSettings();

  return (
    <section className="dc-container mt-6">
      <div className="dc-page-hero p-5 md:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">Checkout</p>
      <h1 className="mt-1 text-4xl font-black leading-tight text-[var(--dc-black)] md:text-5xl">Complete your order</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dc-muted)]">
        {liveOrderReady
          ? onlinePaymentReady
            ? "Choose Cash on Delivery or pay securely online. Login is required before placing an order."
            : "Cash on Delivery is available for logged-in customers. Online payment will be shown when available."
          : publicSupabaseConfigured
            ? "Cash on Delivery is available for logged-in customers. Online payment will be shown when available."
            : "Checkout is temporarily unavailable. Please contact support for help placing your order."}
      </p>
      </div>
      <div className="mt-4">
        <CheckoutForm
          userId={user?.id ?? null}
          liveOrderReady={liveOrderReady}
          onlinePaymentReady={onlinePaymentReady}
          shippingSettings={shippingSettings}
        />
      </div>
    </section>
  );
}
