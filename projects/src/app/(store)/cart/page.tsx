import { CartView } from "@/components/store/cart-view";
import { EmptyState } from "@/components/empty-state";
import { buildMetadata } from "@/lib/metadata";
import { CartPageClient } from "@/components/store/cart-page-client";
import { getShippingSettings } from "@/lib/shipping-settings";

export const metadata = buildMetadata("Cart");
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const shippingSettings = await getShippingSettings();

  return (
    <section className="dc-container mt-6">
      <div className="dc-page-hero p-5 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">Cart</p>
        <h1 className="mt-1 text-4xl font-black leading-tight text-[var(--dc-heading)] md:text-5xl">Review your cart</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--dc-muted)]">Update quantities, remove items, and continue to secure checkout.</p>
      </div>
      <div className="mt-4">
        <CartPageClient empty={<EmptyState title="Your cart is empty" description="Add premium shoes or watches to continue." ctaLabel="Start shopping" ctaHref="/shop" />}>
          <CartView shippingSettings={shippingSettings} />
        </CartPageClient>
      </div>
    </section>
  );
}
