import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { buildOrderSuccessPath } from "@/lib/safe-navigation";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import { canQueryOrders, findOrderForUser } from "@/lib/orders/order-repository";
import { buildOrderStatusView } from "@/lib/orders/order-status";

export const metadata = {
  ...buildMetadata("Track Order"),
  robots: { index: false, follow: false }
};

export const revalidate = 0;

export default async function TrackOrderPage({
  params
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber: rawOrderNumber } = await params;
  const orderNumber = decodeOrderNumberParam(rawOrderNumber);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/order/track/${orderNumber}`)}`);
  }

  if (!isValidOrderNumber(orderNumber) || !canQueryOrders()) {
    return (
      <section className="container py-16">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 text-center card-shadow">
          <PackageSearch className="mx-auto h-12 w-12 text-slate-400" />
          <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-950">Track order</h1>
          <p className="mt-3 text-slate-600">We could not load tracking for this order reference.</p>
          <Link href="/my-orders" className="mt-6 inline-block">
            <Button>Go to my orders</Button>
          </Link>
        </div>
      </section>
    );
  }

  const order = await findOrderForUser(orderNumber, user.id);

  if (!order) {
    return (
      <section className="container py-16">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 text-center card-shadow">
          <PackageSearch className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-950">Order not found</h1>
          <p className="mt-3 text-slate-600">
            Order <strong>{orderNumber}</strong> is not linked to your account yet.
          </p>
          <Link href="/my-orders" className="mt-6 inline-block">
            <Button>View my orders</Button>
          </Link>
        </div>
      </section>
    );
  }

  const status = buildOrderStatusView({
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status
  });

  return (
    <section className="container py-10 sm:py-16">
      <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-6 card-shadow sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Order tracking</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-slate-950">{order.order_number}</h1>
        <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Order status:</span> {status.displayOrderStatus}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Payment status:</span> {status.displayPaymentStatus}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Payment method:</span> {status.displayPaymentMethod}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Total:</span> {formatCurrency(Number(order.total ?? 0))}
          </p>
          <p>
            <span className="font-semibold text-slate-900">WhatsApp:</span>{" "}
            {order.whatsapp_status === "sent" ? "Confirmation sent" : order.whatsapp_status ?? "Pending"}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={buildOrderSuccessPath(order.order_number)}>
            <Button>View confirmation</Button>
          </Link>
          <Link href="/my-orders">
            <Button variant="outline">All orders</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
