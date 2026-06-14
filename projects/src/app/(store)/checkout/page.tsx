import { CheckoutForm } from "@/components/store/checkout-form";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
  const shippingSettings = await getShippingSettings();

  return (
    <section className="section" style={{ paddingTop: "24px" }}>
      <div className="container">
        <div className="glass-card p-6 md:p-8 anim-fade-up">
          <p className="eyebrow">Checkout</p>
          <h1 className="display-xl" style={{ marginTop: "8px" }}>Complete your order</h1>
          <p className="body" style={{ marginTop: "8px" }}>
            {liveOrderReady
              ? onlinePaymentReady
                ? "Choose Cash on Delivery or pay securely online."
                : "Cash on Delivery is available. Online payment will be shown when available."
              : publicSupabaseConfigured
                ? "Cash on Delivery is available. Online payment will be shown when available."
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
      </div>
    </section>
  );
}
