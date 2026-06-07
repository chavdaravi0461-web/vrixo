import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CreditCard,
  IndianRupee,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users,
  Star,
  MessageSquare,
  TicketPercent,
  Eye,
  Zap,
  Smartphone,
  Sparkles,
  Bot,
  Radar,
  Headphones,
  Bell,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSummary } from "@/services/admin";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { OrderTrendChart } from "@/components/admin/order-trend-chart";

export const metadata = buildMetadata("Command Center");
export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function cnt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const summary = await getAdminSummary();

  const [ordersRes, lowStockRes, topRes, contactsRes, dailyRes, ticketsRes, notifsRes] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_name, total, order_status, payment_status, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("products").select("id, title, stock, price").lte("stock", 5).order("stock", { ascending: true }).limit(5),
    supabase.from("order_items").select("product_title, quantity").order("quantity", { ascending: false }).limit(5),
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("orders").select("created_at, total").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("created_at", { ascending: true }),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_on_admin"]),
    supabase.from("order_notifications").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const recentOrders = ordersRes.data ?? [];
  const lowStock = lowStockRes.data ?? [];
  const topProducts = topRes.data ?? [];
  const newContacts = contactsRes.count ?? 0;
  const dailyData = dailyRes.data ?? [];
  const openTickets = ticketsRes.count ?? 0;
  const failedNotifs = notifsRes.count ?? 0;

  const revenue = summary.totalRevenue ?? 0;
  const orders = summary.totalOrders ?? 0;
  const users = summary.totalUsers ?? 0;
  const products = summary.activeProducts ?? summary.totalProducts ?? 0;
  const pendingOrders = summary.pendingOrders ?? 0;
  const todayOrders = summary.todayOrders ?? 0;
  const todayRevenue = summary.todayRevenue ?? 0;
  const completedOrders = summary.completedOrders ?? 0;
  const aov = orders > 0 ? Math.round(revenue / orders) : 0;
  const codOrders = summary.codOrders ?? 0;
  const paidOrders = orders - codOrders;

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi">
      {/* ─── Hero ─── */}
      <section className="os-hero p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="os-dot live" />
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">System Online · AI Core Active</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">
                Command Center
              </h1>
              <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
                {cnt(orders)} orders processed · {fmt(revenue)} total revenue · {cnt(users)} customers
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard-admin-vrixo-ravi/products" className="os-btn os-btn-primary">
                <Plus className="h-3.5 w-3.5" /> New Product
              </Link>
              <Link href="/dashboard-admin-vrixo-ravi/orders" className="os-btn os-btn-ghost">
                <Eye className="h-3.5 w-3.5" /> Orders
              </Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QA href="/dashboard-admin-vrixo-ravi/products" icon={Package} label="Catalog" />
            <QA href="/dashboard-admin-vrixo-ravi/orders" icon={ShoppingCart} label="Orders" />
            <QA href="/dashboard-admin-vrixo-ravi/coupons" icon={TicketPercent} label="Promotions" />
            <QA href="/dashboard-admin-vrixo-ravi/contacts" icon={MessageSquare} label={newContacts ? `Inbox (${newContacts})` : "Inbox"} />
            <QA href="/dashboard-admin-vrixo-ravi/tickets" icon={Headphones} label={openTickets ? `Tickets (${openTickets})` : "Tickets"} />
            <QA href="/dashboard-admin-vrixo-ravi/notifications" icon={Bell} label={failedNotifs ? `Failed (${failedNotifs})` : "Notifications"} />
          </div>
        </div>
      </section>

      {/* ─── Metrics ─── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={IndianRupee} label="Total Revenue" value={fmt(revenue)} trend="+12.5% vs last month" up color="indigo" />
        <Metric icon={ShoppingCart} label="Total Orders" value={cnt(orders)} trend={`${pendingOrders} pending`} up={false} color="rose" />
        <Metric icon={Users} label="Customers" value={cnt(users)} trend="Registered profiles" color="emerald" />
        <Metric icon={Package} label="Products" value={cnt(products)} trend={`${lowStock.length} low stock alerts`} up={false} color="amber" />
        <Metric icon={TrendingUp} label="Today" value={cnt(todayOrders)} trend={fmt(todayRevenue)} up color="sky" />
        <Metric icon={AlertTriangle} label="Needs Attention" value={cnt(pendingOrders)} trend="Awaiting processing" up={false} color="rose" />
        <Metric icon={Star} label="Completed" value={cnt(completedOrders)} trend={codOrders > 0 ? `${cnt(codOrders)} COD` : "All online"} color="emerald" />
        <Metric icon={BarChart3} label="Avg Order Value" value={fmt(aov)} trend={paidOrders > codOrders ? "Mostly prepaid" : "Mostly COD"} color="violet" />
      </div>

      {/* ─── Charts ─── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Revenue Intelligence</h3>
              <p>Last 7 days · transaction volume</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-accent-soft)] text-[var(--os-accent)]">
              <IndianRupee className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="p-4">
            <RevenueChart data={dailyData} />
          </div>
        </div>
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Order Flow</h3>
              <p>Daily order volume · 7 day view</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-accent-soft)] text-[var(--os-accent)]">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="p-4">
            <OrderTrendChart data={dailyData} />
          </div>
        </div>
      </div>

      {/* ─── AI Insights ─── */}
      <div className="mt-5 os-card">
        <div className="os-card-header">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--os-accent)]" />
            <div>
              <h3>AI Intelligence</h3>
              <p>Real-time store analysis</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--os-accent-soft)] px-2 py-0.5 text-[9px] font-semibold text-[var(--os-accent)]">
            <Radar className="h-2.5 w-2.5" /> Live
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="os-insight">
            <p className="i-label">Revenue Velocity</p>
            <p className="i-value">{fmt(todayRevenue)}</p>
            <p className="i-sub">{todayOrders > 0 ? `${cnt(todayOrders)} orders today` : "No orders yet today"}</p>
          </div>
          <div className="os-insight">
            <p className="i-label">Payment Mix</p>
            <p className="i-value">{orders > 0 ? `${Math.round((paidOrders / orders) * 100)}%` : "—"}</p>
            <p className="i-sub">Online · {cnt(paidOrders)} prepaid orders</p>
          </div>
          <div className="os-insight">
            <p className="i-label">Inventory Health</p>
            <p className="i-value">{lowStock.length > 0 ? `${lowStock.length} alert${lowStock.length > 1 ? "s" : ""}` : "Healthy"}</p>
            <p className="i-sub">{lowStock.length > 0 ? "Restock needed" : "All products stocked"}</p>
          </div>
        </div>
      </div>

      {/* ─── Bottom Split ─── */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        {/* Activity Feed */}
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Activity Feed</h3>
              <p>Latest transactions</p>
            </div>
            <Link href="/dashboard-admin-vrixo-ravi/orders" className="os-btn os-btn-ghost" style={{ padding: "4px 10px", fontSize: "10px" }}>
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--os-border)]">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="os-row flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--os-accent-soft)] text-[10px] font-bold text-[var(--os-accent)]">
                      {order.order_number?.slice(-2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)] truncate">{order.order_number}</p>
                      <p className="text-sm font-semibold text-[var(--os-text)] truncate">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`os-badge ${statusClass(order.order_status)}`}>{order.order_status}</span>
                    <span className="text-sm font-bold text-white tabular-nums">{fmt(order.total)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-[var(--os-text-3)]">No orders yet.</p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-5">
          {/* Low Stock */}
          <div className="os-card">
            <div className="os-card-header">
              <div>
                <h3>Inventory</h3>
                <p>{lowStock.length} below threshold</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-danger-soft)] text-[var(--os-danger)]">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="divide-y divide-[var(--os-border)]">
              {lowStock.length > 0 ? (
                lowStock.map((p) => (
                  <div key={p.id} className="os-row flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm font-medium text-[var(--os-text)] truncate min-w-0">{p.title}</p>
                    <span className="shrink-0 ml-2 rounded-full bg-[var(--os-danger-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--os-danger)]">{p.stock} left</span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm text-[var(--os-text-3)]">All well-stocked.</p>
              )}
            </div>
          </div>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <div className="os-card">
              <div className="os-card-header">
                <div>
                  <h3>Top Performers</h3>
                  <p>Highest selling</p>
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-success-soft)] text-[var(--os-success)]">
                  <Zap className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="divide-y divide-[var(--os-border)]">
                {topProducts.map((item, i) => (
                  <div key={i} className="os-row flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--os-surface-3)] text-[9px] font-bold text-[var(--os-text-3)]">{i + 1}</span>
                      <p className="text-sm font-medium text-[var(--os-text)] truncate">{item.product_title}</p>
                    </div>
                    <span className="shrink-0 ml-2 text-xs font-bold text-[var(--os-success)]">{item.quantity} sold</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Split */}
          <div className="os-card">
            <div className="os-card-header">
              <div>
                <h3>Payment Split</h3>
                <p>COD vs Online</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-success-soft)] text-[var(--os-success)]">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--os-text)]">Prepaid</p>
                    <p className="text-[10px] text-[var(--os-text-3)]">{cnt(paidOrders)} orders</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-white tabular-nums">{orders > 0 ? Math.round((paidOrders / orders) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--os-surface-3)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--os-success)] to-[var(--os-accent)]" style={{ width: `${orders > 0 ? (paidOrders / orders) * 100 : 0}%` }} />
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-warning-soft)] text-[var(--os-warning)]">
                    <Smartphone className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--os-text)]">COD</p>
                    <p className="text-[10px] text-[var(--os-text-3)]">{cnt(codOrders)} orders</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-white tabular-nums">{orders > 0 ? Math.round((codOrders / orders) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

/* ─── Sub-components ─── */

function QA({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href} className="os-qa">
      <Icon className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </Link>
  );
}

function Metric({
  icon: Icon, label, value, trend, up, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; trend: string;
  up?: boolean; color: string;
}) {
  const glowMap: Record<string, string> = {
    indigo: 'rgba(99,102,241,1)', rose: 'rgba(244,63,94,1)',
    emerald: 'rgba(16,185,129,1)', amber: 'rgba(245,158,11,1)',
    sky: 'rgba(6,182,212,1)', violet: 'rgba(139,92,246,1)',
  };
  const iconBg: Record<string, string> = {
    indigo: 'rgba(99,102,241,0.1)', rose: 'rgba(244,63,94,0.1)',
    emerald: 'rgba(16,185,129,0.1)', amber: 'rgba(245,158,11,0.1)',
    sky: 'rgba(6,182,212,0.1)', violet: 'rgba(139,92,246,0.1)',
  };
  const trendCls = up === undefined ? "neutral" : up ? "up" : "down";

  return (
    <div className="os-metric">
      <div className="m-glow" style={{ background: glowMap[color] }} />
      <div className="m-top">
        <div>
          <div className="m-label">{label}</div>
          <div className="m-value">{value}</div>
          <div className={`m-trend ${trendCls}`}>
            {up === true ? "↑" : up === false ? "↓" : "—"} {trend}
          </div>
        </div>
        <div className="m-icon" style={{ background: iconBg[color], color: glowMap[color] }}>
          <Icon className="h-[16px] w-[16px]" />
        </div>
      </div>
    </div>
  );
}

function statusClass(status: string): string {
  const m: Record<string, string> = {
    pending: "os-badge-warning",
    processing: "os-badge-info",
    shipped: "os-badge-info",
    delivered: "os-badge-success",
    cancelled: "os-badge-danger",
  };
  return m[status?.toLowerCase()] ?? "os-badge-gray";
}
