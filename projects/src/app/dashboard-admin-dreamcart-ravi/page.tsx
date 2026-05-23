import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  IndianRupee,
  MessageSquare,
  Package,
  ShoppingCart,
  Truck,
  Users
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSummary } from "@/services/admin";

export const metadata = buildMetadata("Admin Dashboard");
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const summary = await getAdminSummary();
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, total, order_status, payment_status")
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: lowStock } = await supabase
    .from("products")
    .select("id, title, stock")
    .lte("stock", 5)
    .order("stock", { ascending: true });

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi">
      <section className="admin-hero p-6 md:p-8">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
              Vrixo command center
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
              Run the store with fewer clicks.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              Catalog health, orders, customers, payments, contacts, and low-stock alerts in one clean workspace built for daily operations.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <QuickAction href="/dashboard-admin-dreamcart-ravi/products" label="Add product" icon={Package} />
            <QuickAction href="/dashboard-admin-dreamcart-ravi/orders" label="Process orders" icon={Truck} />
            <QuickAction href="/dashboard-admin-dreamcart-ravi/contacts" label="Support inbox" icon={MessageSquare} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Package} label="Products" value={summary.activeProducts ?? summary.totalProducts} hint="Active catalog" />
        <SummaryCard icon={ShoppingCart} label="Orders" value={summary.totalOrders} hint="All captured orders" />
        <SummaryCard icon={Users} label="Users" value={summary.totalUsers} hint="Customer profiles" />
        <SummaryCard icon={IndianRupee} label="Revenue" value={`Rs. ${summary.totalRevenue}`} hint="Saved order totals" />
        <SummaryCard icon={MessageSquare} label="Pending messages" value={summary.pendingNotifications ?? 0} hint="Queued WhatsApp/SMS notifications" tone="info" />
        <SummaryCard icon={AlertTriangle} label="Notification failures" value={summary.failedNotifications ?? 0} hint="Needs retry or review" tone="warn" />
        <SummaryCard icon={ShoppingCart} label="Today" value={summary.todayOrders ?? 0} hint={`Rs. ${summary.todayRevenue ?? 0} today`} tone="info" />
        <SummaryCard icon={AlertTriangle} label="Pending" value={summary.pendingOrders ?? 0} hint="Needs attention" tone="warn" />
        <SummaryCard icon={CheckCircle2} label="Completed" value={summary.completedOrders ?? 0} hint={`${summary.paidOrders ?? 0} online paid`} tone="success" />
        <SummaryCard icon={Truck} label="COD" value={summary.codOrders ?? 0} hint="Pay on delivery" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="admin-table-card">
          <PanelHeader
            title="Recent orders"
            description="Latest customer orders with status and payment state."
            href="/dashboard-admin-dreamcart-ravi/orders"
          />
          <div className="divide-y divide-slate-100">
            {recentOrders?.length ? (
              recentOrders.map((order) => (
                <div key={order.id} className="grid gap-3 p-5 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      {order.order_number}
                    </p>
                    <h3 className="mt-2 text-base font-bold text-slate-950">{order.customer_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.order_status} / {order.payment_status ?? "pending"}
                    </p>
                  </div>
                  <p className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
                    Rs. {order.total}
                  </p>
                </div>
              ))
            ) : (
              <EmptyPanel text="No recent orders yet." />
            )}
          </div>
        </section>

        <section className="admin-table-card">
          <PanelHeader
            title="Low stock alerts"
            description="Products at 5 units or lower."
            href="/dashboard-admin-dreamcart-ravi/products"
          />
          <div className="divide-y divide-slate-100">
            {lowStock?.length ? (
              lowStock.map((product) => (
                <div key={product.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="font-bold text-slate-950">{product.title}</h3>
                    <p className="mt-1 text-sm text-red-600">Only {product.stock} left in stock</p>
                  </div>
                  <span className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                    Restock
                  </span>
                </div>
              ))
            ) : (
              <EmptyPanel text="No low stock alerts right now." />
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white transition hover:bg-white hover:text-slate-950">
      <Icon className="h-5 w-5" />
      <span className="mt-3 block text-sm font-black">{label}</span>
    </Link>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default"
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "warn" | "success" | "info";
}) {
  const toneClass = {
    default: "bg-slate-950 text-white",
    warn: "bg-amber-100 text-amber-800",
    success: "bg-emerald-100 text-emerald-800",
    info: "bg-sky-100 text-sky-800"
  }[tone];

  return (
    <div className="admin-kpi p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">{value}</h2>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

function PanelHeader({
  title,
  description,
  href
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <Link href={href} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-950 hover:text-slate-950">
        Open <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="p-6 text-sm font-semibold text-slate-500">{text}</p>;
}
