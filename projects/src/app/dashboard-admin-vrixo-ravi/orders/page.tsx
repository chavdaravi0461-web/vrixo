import { AdminShell } from "@/components/admin/admin-shell";
import { OrdersAdminClient } from "@/components/admin/orders-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Orders");
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = getPositiveInt(params.page, 1);
  const limit = Math.min(getPositiveInt(params.limit, 20), 50);
  const search = getString(params.search)?.trim();
  const orderStatus = getString(params.order_status);
  const paymentStatus = getString(params.payment_status);
  const paymentMethod = getString(params.payment_method);
  const dateFrom = getString(params.date_from);
  const dateTo = getString(params.date_to);
  const sort = getString(params.sort) ?? "newest";
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = createAdminClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, customer_email, payment_method, payment_status, order_status, sms_status, whatsapp_status, total, razorpay_order_id, razorpay_payment_id, created_at, shipping_address, items",
      { count: "exact" }
    );

  if (search) {
    const safeSearch = search.replace(/[%_,]/g, "");
    query = query.or(
      `order_number.ilike.%${safeSearch}%,customer_name.ilike.%${safeSearch}%,customer_phone.ilike.%${safeSearch}%,customer_email.ilike.%${safeSearch}%,razorpay_payment_id.ilike.%${safeSearch}%`
    );
  }

  if (orderStatus && orderStatus !== "all") query = query.eq("order_status", orderStatus);
  if (paymentStatus && paymentStatus !== "all") query = query.eq("payment_status", paymentStatus);
  if (paymentMethod && paymentMethod !== "all") query = query.eq("payment_method", paymentMethod);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "total-desc") query = query.order("total", { ascending: false });
  else if (sort === "total-asc") query = query.order("total", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const { data: orders, count } = await query.range(from, to);

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/orders">
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Fulfillment Desk</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Manage Orders</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
            Search orders, review customer details, verify payment state, and move shipments through the daily workflow.
          </p>
        </div>
      </section>
      <OrdersAdminClient
        orders={orders ?? []}
        pagination={{ page, limit, total: count ?? 0 }}
        filters={{
          search: search ?? "",
          orderStatus: orderStatus ?? "all",
          paymentStatus: paymentStatus ?? "all",
          paymentMethod: paymentMethod ?? "all",
          dateFrom: dateFrom ?? "",
          dateTo: dateTo ?? "",
          sort
        }}
      />
    </AdminShell>
  );
}

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(getString(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}
