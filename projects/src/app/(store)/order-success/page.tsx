import Link from "next/link";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/metadata";
import { buildOrderSuccessPath } from "@/lib/safe-navigation";
import { decodeOrderNumberParam, isValidOrderNumber, normalizeOrderNumber } from "@/lib/orders/order-numbers";

export const metadata = { ...buildMetadata("Order Success"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderSuccessIndexPage({ searchParams }: {
  searchParams: Promise<{ orderNumber?: string; order_number?: string; order?: string; verifiedPayment?: string; paymentStatus?: string; orderStatus?: string; paymentMethod?: string }>;
}) {
  const query = await searchParams;
  const rawOrderNumber = query.orderNumber ?? query.order_number ?? query.order;

  if (rawOrderNumber) {
    const orderNumber = normalizeOrderNumber(decodeOrderNumberParam(rawOrderNumber));
    if (isValidOrderNumber(orderNumber)) {
      redirect(buildOrderSuccessPath(orderNumber, { verifiedPayment: query.verifiedPayment, paymentStatus: query.paymentStatus, orderStatus: query.orderStatus, paymentMethod: query.paymentMethod }));
    }
  }

  return (
    <section className="section" style={{ paddingTop: "60px" }}>
      <div className="container">
        <div className="glass-card" style={{ maxWidth: "480px", margin: "0 auto", padding: "40px", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)" }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="eyebrow">Order reference needed</p>
          <h1 className="display-md" style={{ marginTop: "12px", fontSize: "22px" }}>We could not open this confirmation</h1>
          <p className="body-sm" style={{ marginTop: "8px" }}>
            The checkout completed, but this link did not include a valid order number. Open your order history to view the latest confirmation and tracking status.
          </p>
          <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: "24px" }}>
            <Link href="/my-orders" className="hero-btn hero-btn-primary">View my orders</Link>
            <Link href="/shop" className="hero-btn hero-btn-ghost">Continue shopping</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
