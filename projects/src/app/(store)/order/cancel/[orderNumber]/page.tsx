"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle, CheckCircle, Loader2, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CancelOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.order_number) {
          setOrder(data as Record<string, unknown>);
        } else {
          setError("Order not found.");
        }
      })
      .catch(() => setError("Could not load order details."))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/cancel`, { method: "POST" });
      const data = (await res.json()) as { message?: string };
      setResult({ success: res.ok, message: data.message || (res.ok ? "Order cancelled successfully." : "Failed to cancel.") });
    } catch {
      setResult({ success: false, message: "Something went wrong. Please try again." });
    } finally {
      setCancelling(false);
    }
  }

  const firstItem = Array.isArray(order?.items) ? (order.items[0] as Record<string, unknown>) : null;

  return (
    <section className="container py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 card-shadow">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p className="text-slate-500">Loading order details...</p>
          </div>
        ) : error ? (
          <>
            <PackageSearch className="mx-auto h-12 w-12 text-slate-400" />
            <h1 className="mt-4 text-center font-serif text-3xl font-semibold text-slate-950">Cancel Order</h1>
            <p className="mt-3 text-center text-slate-600">{error}</p>
            <div className="mt-6 text-center">
              <Link href="/my-orders"><Button variant="outline">My Orders</Button></Link>
            </div>
          </>
        ) : result ? (
          result.success ? (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h1 className="mt-4 text-center font-serif text-3xl font-semibold text-slate-950">Order Cancelled</h1>
              <p className="mt-3 text-center text-slate-600">{result.message}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/my-orders"><Button variant="outline">My Orders</Button></Link>
                <Link href="/"><Button>Shop More</Button></Link>
              </div>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="mt-4 text-center font-serif text-3xl font-semibold text-slate-950">Cancellation Failed</h1>
              <p className="mt-3 text-center text-slate-600">{result.message}</p>
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={handleCancel}>Try Again</Button>
              </div>
            </>
          )
        ) : (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-center font-serif text-3xl font-semibold text-slate-950">Cancel Order</h1>
            <p className="mt-2 text-center text-slate-500">#{orderNumber}</p>
            <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {firstItem && <p>🛍 {String(firstItem.title ?? "")}</p>}
              {order?.total != null && <p>💰 ₹{Math.round(Number(order.total))}</p>}
              {order?.order_status != null && <p>📋 Status: {String(order.order_status)}</p>}
            </div>
            <p className="mt-4 text-center text-sm text-slate-500">Are you sure you want to cancel this order?</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.back()}>Keep Order</Button>
              <Button onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
