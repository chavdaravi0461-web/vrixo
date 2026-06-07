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
    <AdminShell current="/dashboard-admin-vrixo-ravi/accounts">
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Guest Checkout Customers</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Customer Accounts</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
            Login ke bina placed orders yahan customer name, mobile, address, payment, product details ke saath show honge.
          </p>
        </div>
      </section>

      <div className="space-y-5">
        {accountOrders.map((order) => (
          <section key={order.id} className="os-card">
            <div className="p-5 grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)]">{order.order_number}</p>
                    <h2 className="mt-1 text-lg font-bold text-[var(--os-text)]">{order.customer_name || "Customer"}</h2>
                  </div>
                  <span className="os-badge os-badge-gray shrink-0">₹{order.total}</span>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <Info label="Mobile" value={order.customer_phone || "Not provided"} />
                  <Info label="Email" value={order.customer_email || "Not provided"} />
                  <Info label="Payment" value={`${order.payment_method ?? "cod"} / ${order.payment_status ?? "pending"}`} />
                  <Info label="Order status" value={order.order_status ?? "pending"} />
                  <Info label="Razorpay" value={order.razorpay_payment_id || "N/A"} />
                  <Info label="Placed" value={order.created_at ? new Date(order.created_at).toLocaleString("en-IN") : "N/A"} />
                </div>

                <div className="mt-4 rounded-[var(--os-radius-sm)] border border-[var(--os-border)] bg-[rgba(255,255,255,0.012)] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--os-text-3)]">Address</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--os-text-2)]">{formatAddress(order.shipping_address)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {(order.items ?? []).map((item, index) => (
                  <div key={`${order.id}-${item.productId ?? index}`} className="flex gap-3 rounded-[var(--os-radius-sm)] border border-[var(--os-border)] p-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[var(--os-surface-3)]">
                      {item.image ? (
                        <Image src={item.image} alt={item.title ?? "Product"} fill className="object-cover" sizes="64px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-[var(--os-text)]">{item.title ?? "Product"}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--os-text-3)]">ID: {item.productId ?? "N/A"}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--os-text-3)]">
                        Qty {item.quantity ?? 1} | ₹{item.price ?? 0}
                        {item.selectedSize ? ` | Size ${item.selectedSize}` : ""}
                        {item.selectedColor ? ` | ${item.selectedColor}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {accountOrders.length === 0 ? (
          <div className="os-card p-8 text-center text-[var(--os-text-3)] text-sm">No customer orders found yet.</div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--os-radius-sm)] border border-[var(--os-border)] bg-[rgba(255,255,255,0.012)] p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--os-text-3)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--os-text)]">{value}</p>
    </div>
  );
}

function formatAddress(address?: Record<string, unknown> | null) {
  if (!address) return "Not provided";
  return [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean).map(String).join(", ");
}
