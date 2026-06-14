import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  CreditCard,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSummary } from "@/services/admin";

export const metadata = buildMetadata("Vrixo Omega — Command Center");
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
function cnt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export default async function CommandCenter() {
  await requireAdmin();
  const supabase = createAdminClient();
  const summary = await getAdminSummary();

  const [ordersRes, lowStockRes, contactsRes, ticketsRes, notifsRes, returnsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer_name, total, order_status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("products")
      .select("id, title, stock, price")
      .lte("stock", 5)
      .order("stock", { ascending: true })
      .limit(5),
    supabase
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "waiting_on_admin"]),
    supabase
      .from("order_notifications")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase
      .from("returns")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "approved"]),
  ]);

  const recentOrders = ordersRes.data ?? [];
  const lowStock = lowStockRes.data ?? [];
  const unreadMessages = contactsRes.count ?? 0;
  const openTickets = ticketsRes.count ?? 0;
  const failedNotifs = notifsRes.count ?? 0;
  const pendingReturns = returnsRes.count ?? 0;

  const revenue = summary.totalRevenue ?? 0;
  const totalOrders = summary.totalOrders ?? 0;
  const totalUsers = summary.totalUsers ?? 0;
  const products = summary.activeProducts ?? summary.totalProducts ?? 0;
  const pendingOrders = summary.pendingOrders ?? 0;
  const todayOrders = summary.todayOrders ?? 0;
  const todayRevenue = summary.todayRevenue ?? 0;
  const codOrders = summary.codOrders ?? 0;
  const paidOrders = totalOrders - codOrders;
  const prepaidPct = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - (lowStock.length + pendingOrders + openTickets + failedNotifs) * 3));

  return (
    <AdminShell>
      <section className="cos-section">
        <div className="cos-section-header">
          <div>
            <div className="cos-section-eyebrow">Live Commerce Intelligence</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Command Center</h2>
          </div>
          <span className="cos-tag cos-tag-emerald">Live</span>
        </div>

        <div className="cos-metrics-strip">
          <MetricCard
            icon={TrendingUp}
            label="Today Revenue"
            value={fmt(todayRevenue)}
            sub={`${cnt(todayOrders)} orders`}
            trend="+12%"
            trendUp
          />
          <MetricCard
            icon={ShoppingCart}
            label="Order Queue"
            value={cnt(pendingOrders)}
            sub="Pending fulfillment"
            trend={pendingOrders > 5 ? "High" : "Normal"}
            trendUp={false}
            warn={pendingOrders > 5}
          />
          <MetricCard
            icon={Users}
            label="Customer Reach"
            value={cnt(totalUsers)}
            sub="Active relationships"
            trend="+8%"
            trendUp
          />
          <MetricCard
            icon={Package}
            label="Inventory Alerts"
            value={cnt(lowStock.length)}
            sub="Critical SKUs"
            trend={lowStock.length > 3 ? "Critical" : "Stable"}
            trendUp={false}
            warn={lowStock.length > 3}
          />
        </div>

        <div style={{ marginTop: "20px" }}>
          <div className="cos-progress-bar">
            <span>Prepaid ratio</span>
            <span>{prepaidPct}%</span>
          </div>
          <div className="cos-progress-track">
            <span className="cos-progress-fill" style={{ width: `${prepaidPct}%` }} />
          </div>
        </div>
      </section>

      <div style={{ marginTop: "20px" }} className="cos-grid-2">
        <section className="cos-section">
          <div className="cos-section-header">
            <div>
              <div className="cos-section-eyebrow">AI Command</div>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Priority directives</h2>
            </div>
            <span className="cos-tag cos-tag-accent">Adaptive</span>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <ActionItem number="1" text={`Restock ${lowStock.length > 0 ? cnt(lowStock.length) : "critical"} SKUs`} icon={AlertTriangle} warn />
            <ActionItem number="2" text={`${cnt(unreadMessages)} unread customer inquiries`} icon={Users} />
            <ActionItem number="3" text={`${cnt(failedNotifs)} failed notifications require retry`} icon={Zap} warn />
          </div>
          <Link href="/dashboard-admin-vrixo-ravi/orders" className="cos-link">
            Open War Room
            <ArrowUpRight style={{ width: 13, height: 13 }} />
          </Link>
        </section>

        <section className="cos-section">
          <div className="cos-section-header">
            <div>
              <div className="cos-section-eyebrow">System Pulse</div>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Health score</h2>
            </div>
            <span className="cos-tag cos-tag-accent">{healthScore}%</span>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <ActionItem number="A" text={`${cnt(products)} live products in catalog`} icon={Box} />
            <ActionItem number="B" text={`${cnt(totalOrders)} total orders processed`} icon={TrendingUp} />
            <ActionItem number="C" text={`${cnt(pendingReturns)} returns pending review`} icon={Package} warn={pendingReturns > 0} />
          </div>
        </section>
      </div>

      <div style={{ marginTop: "20px" }} className="cos-grid-2">
        <section className="cos-section">
          <div className="cos-section-header">
            <div>
              <div className="cos-section-eyebrow">Operations Feed</div>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Recent order signals</h2>
            </div>
            <span className="cos-tag cos-tag-emerald">Live</span>
          </div>
          <div className="cos-feed-list" style={{ maxHeight: "280px", overflowY: "auto" }}>
            {recentOrders.length > 0 ? (
              recentOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="cos-feed-item">
                  <div className={`cos-feed-dot cos-feed-dot-${order.order_status === "delivered" ? "success" : order.order_status === "cancelled" ? "danger" : "info"}`} />
                  <div>
                    <div className="cos-feed-text">
                      <strong>{order.order_number}</strong> — {order.customer_name}
                    </div>
                    <div className="cos-feed-time">
                      {order.order_status} · {fmt(order.total)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "12px", color: "var(--cos-text-tertiary)" }}>No recent order signals.</p>
            )}
          </div>
        </section>

        <section className="cos-section">
          <div className="cos-section-header">
            <div>
              <div className="cos-section-eyebrow">Commerce Signals</div>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Live performance</h2>
            </div>
            <span className="cos-tag cos-tag-accent">Connected</span>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <ActionItem number="1" text={`${cnt(paidOrders)} prepaid orders balanced across platform`} icon={CreditCard} />
            <ActionItem number="2" text={`${cnt(codOrders)} COD orders active`} icon={CreditCard} />
            <ActionItem number="3" text={openTickets > 0 ? `${cnt(openTickets)} support tickets awaiting review` : "Support queue clear"} icon={Star} warn={openTickets > 0} />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  trendUp,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`cos-metric-card ${warn ? "cos-metric-warn" : ""}`}>
      <div className="cos-metric-icon">
        <Icon />
      </div>
      <div className="cos-metric-label">{label}</div>
      <div className="cos-metric-value">{value}</div>
      <div className="cos-metric-sub">{sub}</div>
      <div className={`cos-metric-trend ${trendUp ? "cos-metric-trend-up" : ""}`}>
        {trendUp ? "↑" : "—"} {trend}
      </div>
    </div>
  );
}

function ActionItem({
  number,
  text,
  icon: Icon,
  warn,
}: {
  number: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  warn?: boolean;
}) {
  return (
    <div className="cos-action-item">
      <div className="cos-action-number" style={warn ? { color: "var(--cos-amber)", borderColor: "var(--cos-amber)" } : {}}>
        <Icon />
      </div>
      <div className="cos-action-text">{text}</div>
    </div>
  );
}
