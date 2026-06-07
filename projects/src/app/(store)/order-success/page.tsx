import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { buildOrderSuccessPath } from "@/lib/safe-navigation";
import { decodeOrderNumberParam, isValidOrderNumber, normalizeOrderNumber } from "@/lib/orders/order-numbers";
import { Button } from "@/components/ui/button";

export const metadata = {
  ...buildMetadata("Order Success"),
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function OrderSuccessIndexPage({
  searchParams
}: {
  searchParams: Promise<{
    orderNumber?: string;
    order_number?: string;
    order?: string;
    verifiedPayment?: string;
    paymentStatus?: string;
    orderStatus?: string;
    paymentMethod?: string;
  }>;
}) {
  const query = await searchParams;
  const rawOrderNumber = query.orderNumber ?? query.order_number ?? query.order;

  if (rawOrderNumber) {
    const orderNumber = normalizeOrderNumber(decodeOrderNumberParam(rawOrderNumber));

    if (isValidOrderNumber(orderNumber)) {
      redirect(
        buildOrderSuccessPath(orderNumber, {
          verifiedPayment: query.verifiedPayment,
          paymentStatus: query.paymentStatus,
          orderStatus: query.orderStatus,
          paymentMethod: query.paymentMethod
        })
      );
    }
  }

  return (
    <section className="container py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 text-center card-shadow">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-600" aria-hidden="true" />
        <p className="mt-5 text-sm font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">
          Order reference needed
        </p>
        <h1 className="mt-3 text-3xl font-black text-[var(--dc-heading)]">
          We could not open this confirmation
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--dc-muted)]">
          The checkout completed, but this link did not include a valid order number. Open your
          order history to view the latest confirmation and tracking status.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/my-orders">
            <Button>View my orders</Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Continue shopping</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
