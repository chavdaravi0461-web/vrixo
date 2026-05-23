import Image from "next/image";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Customer Accounts");
export const dynamic = "force-dynamic";

type AccountOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  order_status?: string | null;
  total: number;
  created_at?: string | null;
  shipping_address?: Record<string, unknown> | null;
  razorpay_payment_id?: string | null;
  items?: Array<{
    productId?: string;
    title?: string;
    image?: string;
    quantity?: number;
    price?: number;
    selectedSize?: string | null;
    selectedColor?: string | null;
  }>;
};

export default async function AdminAccountsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, customer_email, payment_method, payment_status, order_status, total, created_at, shipping_address, razorpay_payment_id, items")
    .order("created_at", { ascending: false });

  const accountOrders = (orders ?? []) as AccountOrder[];

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi/accounts">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
          Guest checkout customers
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Customer accounts</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          Login ke bina placed orders yahan customer name, mobile, address, payment, product ID,
          image, quantity, and order status ke saath show honge.
        </p>
        </div>
      </section>

      <div className="space-y-5">
        {accountOrders.map((order) => (
          <section key={order.id} className="admin-card p-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {order.order_number}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      {order.customer_name || "Customer"}
                    </h2>
                  </div>
                  <div className="rounded-md bg-slate-100 px-3 py-2 text-right text-sm font-semibold text-slate-700">
                    Rs. {order.total}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <Info label="Mobile" value={order.customer_phone || "Not provided"} />
                  <Info label="Email" value={order.customer_email || "Not provided"} />
                  <Info label="Payment" value={`${order.payment_method ?? "cod"} / ${order.payment_status ?? "pending"}`} />
                  <Info label="Order status" value={order.order_status ?? "pending"} />
                  <Info label="Razorpay payment" value={order.razorpay_payment_id || "Not applicable"} />
                  <Info
                    label="Placed"
                    value={order.created_at ? new Date(order.created_at).toLocaleString("en-IN") : "Not available"}
                  />
                </div>

                <div className="mt-4 rounded-md bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Address
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {formatAddress(order.shipping_address)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {(order.items ?? []).map((item, index) => (
                  <div key={`${order.id}-${item.productId ?? index}`} className="flex gap-3 rounded-md border border-slate-200 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {item.image ? (
                        <Image src={item.image} alt={item.title ?? "Product"} fill className="object-cover" sizes="80px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-slate-950">{item.title ?? "Product"}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        Product ID: {item.productId ?? "Not available"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {item.quantity ?? 1} | Rs. {item.price ?? 0}
                        {item.selectedSize ? ` | Size ${item.selectedSize}` : ""}
                        {item.selectedColor ? ` | Color ${item.selectedColor}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {accountOrders.length === 0 ? (
          <div className="admin-card p-8 text-center text-slate-600">
            No customer orders found yet.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}

function formatAddress(address?: Record<string, unknown> | null) {
  if (!address) return "Not provided";

  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ]
    .filter(Boolean)
    .map(String)
    .join(", ");
}
