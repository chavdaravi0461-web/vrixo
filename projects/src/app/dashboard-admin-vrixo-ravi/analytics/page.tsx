import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  CheckCircle2,
  CreditCard,
  Package,
  ShoppingBag,
  Target,
  TrendingUp,
  Truck,
  Users
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Analytics");
export const dynamic = "force-dynamic";

type OrderItem = {
  productId?: string;
  title?: string;
  quantity?: number;
  price?: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  created_at: string;
  subtotal: number | string | null;
  discount: number | string | null;
  shipping_charge: number | string | null;
  total: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string | null;
  shipping_address: Record<string, unknown> | null;
  items: unknown;
};

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, customer_email, created_at, subtotal, discount, shipping_charge, total, payment_method, payment_status, order_status, shipping_address, items"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const orders = ((data ?? []) as OrderRow[]).map(normalizeOrder);
  const analytics = buildAnalytics(orders);

  return (
    <AdminShell>
      <section className="cos-section">
        <div className="cos-section-header">
          <div>
            <div className="cos-section-eyebrow">Sales Intelligence</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Analytics</h2>
            <p style={{ fontSize: "12px", color: "var(--cos-text-tertiary)", marginTop: "4px", maxWidth: "480px" }}>
              Revenue, payment health, fulfillment pressure, and product winners from the latest 1,000 orders.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            <HeroMetric label="Today" value={money(analytics.todayRevenue)} />
            <HeroMetric label="30 day" value={money(analytics.last30Revenue)} />
            <HeroMetric label="AOV" value={money(analytics.averageOrderValue)} />
          </div>
        </div>
      </section>

      <div className="cos-metrics-strip" style={{ marginTop: "16px" }}>
        <Metric icon={BadgeIndianRupee} label="Net Sales" value={money(analytics.netRevenue)} hint={`${analytics.saleOrders} orders`} />
        <Metric icon={TrendingUp} label="30 Day Growth" value={percent(analytics.growthRate)} hint={`${money(analytics.previous30Revenue)} prev 30d`} up={analytics.growthRate >= 0} />
        <Metric icon={ShoppingBag} label="Orders Today" value={analytics.todayOrders} hint={`${analytics.pendingOrders} pending`} />
        <Metric icon={Target} label="Avg Order Value" value={money(analytics.averageOrderValue)} hint={`${money(analytics.bestOrderTotal)} highest`} />
        <Metric icon={CreditCard} label="Online Paid" value={analytics.paidOrders} hint={money(analytics.onlinePaidRevenue)} />
        <Metric icon={Banknote} label="COD Load" value={analytics.codOrders} hint={money(analytics.codRevenue)} />
        <Metric icon={Truck} label="In Fulfillment" value={analytics.fulfillmentOrders} hint="Processing, packed, shipped" />
        <Metric icon={AlertTriangle} label="At Risk" value={analytics.riskOrders} hint={`${money(analytics.riskRevenue)} exposed`} />
      </div>

      <div className="cos-grid-2" style={{ marginTop: "16px" }}>
        <div className="cos-section">
          <div className="cos-section-header">
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700 }}>14 Day Sales Pulse</h3>
              <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Daily order volume and revenue trend</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: "10px", padding: "16px" }}>
            {analytics.dailyTrend.map((day) => (
              <TrendRow
                key={day.key}
                label={day.label}
                value={money(day.revenue)}
                sub={`${day.orders} orders`}
                width={analytics.maxDailyRevenue ? (day.revenue / analytics.maxDailyRevenue) * 100 : 0}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="cos-section">
            <div className="cos-section-header">
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 700 }}>Control Tower</h3>
                <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Signals needing attention</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: "8px", padding: "12px" }}>
              <SignalCard icon={AlertTriangle} title="Pending Order Value" value={money(analytics.pendingRevenue)} description={`${analytics.pendingOrders} orders need confirmation.`} href="/dashboard-admin-vrixo-ravi/orders?order_status=pending" />
              <SignalCard icon={CreditCard} title="Failed Payment Value" value={money(analytics.failedPaymentRevenue)} description={`${analytics.failedPaymentOrders} failed payments.`} href="/dashboard-admin-vrixo-ravi/orders?payment_status=failed" />
              <SignalCard icon={CheckCircle2} title="Delivered Revenue" value={money(analytics.deliveredRevenue)} description={`${analytics.deliveredOrders} completed.`} href="/dashboard-admin-vrixo-ravi/orders?order_status=delivered" />
            </div>
          </div>
        </div>
      </div>

      <div className="cos-grid-2" style={{ marginTop: "16px", gridTemplateColumns: "1fr 1fr 1fr" }}>
        <BreakdownPanel title="Payment Mix" rows={analytics.paymentMix} />
        <BreakdownPanel title="Order Status" rows={analytics.statusMix} />
        <BreakdownPanel title="Top Delivery Cities" rows={analytics.cityMix} emptyText="No city data yet." />
      </div>

      <div className="cos-grid-2" style={{ marginTop: "16px" }}>
        <div className="cos-section">
          <div className="cos-section-header">
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700 }}>Best Selling Products</h3>
              <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Ranked by quantity sold</p>
            </div>
          </div>
          <div>
            {analytics.topProducts.length ? (
              analytics.topProducts.map((product, i) => (
                <RankRow key={product.key} rank={i + 1} title={product.title} meta={`${product.quantity} sold`} value={money(product.revenue)} icon={Package} />
              ))
            ) : (
              <EmptyPanel text="No product sales yet." />
            )}
          </div>
        </div>

        <div className="cos-section">
          <div className="cos-section-header">
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700 }}>Top Customers</h3>
              <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Repeat buyers and high value</p>
            </div>
          </div>
          <div>
            {analytics.topCustomers.length ? (
              analytics.topCustomers.map((customer, i) => (
                <RankRow key={customer.key} rank={i + 1} title={customer.name} meta={`${customer.orders} orders`} value={money(customer.revenue)} icon={Users} />
              ))
            ) : (
              <EmptyPanel text="No customer data yet." />
            )}
          </div>
        </div>
      </div>

      <div className="cos-section" style={{ marginTop: "16px" }}>
        <div className="cos-section-header">
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700 }}>Latest High Value Orders</h3>
            <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Recent orders by highest totals</p>
          </div>
          <Link href="/dashboard-admin-vrixo-ravi/orders" className="cos-link" style={{ marginTop: 0 }}>
            View All <ArrowRight style={{ width: 12, height: 12 }} />
          </Link>
        </div>
        <div>
          {analytics.highValueOrders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard-admin-vrixo-ravi/orders?search=${encodeURIComponent(order.orderNumber)}`}
              className="cos-row"
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cos-text-tertiary)" }}>{order.orderNumber}</p>
                <p style={{ fontSize: "13px", fontWeight: 600 }}>{order.customerName}</p>
                <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)" }}>{formatDate(order.createdAt)} · {order.orderStatus} · {order.paymentStatus}</p>
              </div>
              <span style={{ flexShrink: 0, fontSize: "13px", fontWeight: 700 }}>{money(order.total)}</span>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

function buildAnalytics(orders: ReturnType<typeof normalizeOrder>[]) {
  const now = new Date();
  const todayKey = dateKey(now);
  const last30Start = startOfDay(addDays(now, -29));
  const previous30Start = startOfDay(addDays(now, -59));
  const previous30End = startOfDay(addDays(now, -30));
  const saleOrders = orders.filter((order) => !isCancelled(order) && order.paymentStatus !== "failed");
  const last30Orders = saleOrders.filter((order) => order.createdAt >= last30Start);
  const previous30Orders = saleOrders.filter((order) => order.createdAt >= previous30Start && order.createdAt <= previous30End);
  const paidOrders = saleOrders.filter((order) => order.paymentStatus === "paid");
  const codOrders = saleOrders.filter((order) => order.paymentMethod === "cod");
  const pendingOrders = saleOrders.filter((order) => ["pending", "confirmed"].includes(order.orderStatus));
  const fulfillmentOrders = saleOrders.filter((order) => ["processing", "packed", "shipped"].includes(order.orderStatus));
  const failedPaymentOrders = orders.filter((order) => order.paymentStatus === "failed");
  const deliveredOrders = saleOrders.filter((order) => order.orderStatus === "delivered");
  const riskOrders = orders.filter((order) => isCancelled(order) || order.paymentStatus === "failed");
  const netRevenue = sum(saleOrders, "total");
  const last30Revenue = sum(last30Orders, "total");
  const previous30Revenue = sum(previous30Orders, "total");
  const dailyTrend = buildDailyTrend(saleOrders, now);
  const paymentMix = buildBreakdown(saleOrders, (order) => order.paymentMethod === "online" ? "Online" : "COD");
  const statusMix = buildBreakdown(orders, (order) => titleCase(order.orderStatus || "pending"));
  const cityMix = buildBreakdown(saleOrders, (order) => order.city || "Unknown").filter((row) => row.label !== "Unknown").slice(0, 5);
  const highValueOrders = [...saleOrders].sort((a, b) => b.total - a.total).slice(0, 6);

  return {
    netRevenue, saleOrders: saleOrders.length,
    todayRevenue: sum(saleOrders.filter((order) => dateKey(order.createdAt) === todayKey), "total"),
    todayOrders: saleOrders.filter((order) => dateKey(order.createdAt) === todayKey).length,
    last30Revenue, previous30Revenue,
    growthRate: previous30Revenue > 0 ? ((last30Revenue - previous30Revenue) / previous30Revenue) * 100 : last30Revenue > 0 ? 100 : 0,
    averageOrderValue: saleOrders.length ? netRevenue / saleOrders.length : 0,
    bestOrderTotal: Math.max(0, ...saleOrders.map((order) => order.total)),
    paidOrders: paidOrders.length, onlinePaidRevenue: sum(paidOrders.filter((o) => o.paymentMethod === "online"), "total"),
    codOrders: codOrders.length, codRevenue: sum(codOrders, "total"),
    pendingOrders: pendingOrders.length, pendingRevenue: sum(pendingOrders, "total"),
    fulfillmentOrders: fulfillmentOrders.length,
    failedPaymentOrders: failedPaymentOrders.length, failedPaymentRevenue: sum(failedPaymentOrders, "total"),
    deliveredOrders: deliveredOrders.length, deliveredRevenue: sum(deliveredOrders, "total"),
    riskOrders: riskOrders.length, riskRevenue: sum(riskOrders, "total"),
    dailyTrend, maxDailyRevenue: Math.max(0, ...dailyTrend.map((day) => day.revenue)),
    paymentMix, statusMix, cityMix,
    topProducts: buildTopProducts(saleOrders),
    topCustomers: buildTopCustomers(saleOrders),
    highValueOrders,
  };
}

function normalizeOrder(order: OrderRow) {
  const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
  return {
    id: order.id, orderNumber: order.order_number,
    customerName: order.customer_name || "Customer",
    customerKey: order.customer_phone || order.customer_email || order.customer_name || order.id,
    createdAt: new Date(order.created_at),
    subtotal: toNumber(order.subtotal), discount: toNumber(order.discount),
    shippingCharge: toNumber(order.shipping_charge), total: toNumber(order.total),
    paymentMethod: normalizeToken(order.payment_method || "cod"),
    paymentStatus: normalizeToken(order.payment_status || "pending"),
    orderStatus: normalizeToken(order.order_status || "pending"),
    city: getAddressValue(order.shipping_address, "city"), items,
  };
}

function buildDailyTrend(orders: ReturnType<typeof normalizeOrder>[], now: Date) {
  return Array.from({ length: 14 }, (_, i) => {
    const date = startOfDay(addDays(now, i - 13));
    const key = dateKey(date);
    const dayOrders = orders.filter((order) => dateKey(order.createdAt) === key);
    return { key, label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), orders: dayOrders.length, revenue: sum(dayOrders, "total") };
  });
}

function buildBreakdown(orders: ReturnType<typeof normalizeOrder>[], labelFor: (o: ReturnType<typeof normalizeOrder>) => string) {
  const map = new Map<string, { label: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const label = labelFor(order);
    const c = map.get(label) ?? { label, orders: 0, revenue: 0 };
    c.orders += 1; c.revenue += order.total; map.set(label, c);
  });
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return rows.map((r) => ({ ...r, width: (r.revenue / max) * 100 })).slice(0, 7);
}

function buildTopProducts(orders: ReturnType<typeof normalizeOrder>[]) {
  const map = new Map<string, { key: string; title: string; quantity: number; revenue: number }>();
  orders.forEach((order) => order.items.forEach((item) => {
    const title = String(item.title || "Product");
    const key = String(item.productId || title);
    const qty = Number(item.quantity ?? 1);
    const price = Number(item.price ?? 0);
    const c = map.get(key) ?? { key, title, quantity: 0, revenue: 0 };
    c.quantity += qty; c.revenue += price * qty; map.set(key, c);
  }));
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function buildTopCustomers(orders: ReturnType<typeof normalizeOrder>[]) {
  const map = new Map<string, { key: string; name: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const c = map.get(order.customerKey) ?? { key: order.customerKey, name: order.customerName, orders: 0, revenue: 0 };
    c.orders += 1; c.revenue += order.total; map.set(order.customerKey, c);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px", borderRadius: "var(--cos-r)", border: "1px solid var(--cos-border)", background: "rgba(255,255,255,0.03)" }}>
      <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cos-text-tertiary)" }}>{label}</p>
      <p style={{ fontSize: "18px", fontWeight: 800, marginTop: "6px", fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, up }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; hint: string;
  up?: boolean;
}) {
  return (
    <div className="cos-metric-card">
      <div className="cos-metric-icon"><Icon /></div>
      <div className="cos-metric-label">{label}</div>
      <div className="cos-metric-value">{value}</div>
      <div className="cos-metric-sub">{hint}</div>
      {up !== undefined && (
        <div className={`cos-metric-trend ${up ? "cos-metric-trend-up" : ""}`}>
          {up ? "↑" : "↓"} {hint}
        </div>
      )}
    </div>
  );
}

function TrendRow({ label, value, sub, width }: { label: string; value: string; sub: string; width: number }) {
  return (
    <div style={{ display: "grid", gap: "6px", gridTemplateColumns: "90px 1fr 120px", alignItems: "center" }}>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: "10px", color: "var(--cos-text-tertiary)" }}>{sub}</p>
      </div>
      <div className="cos-progress-track" style={{ height: "6px" }}>
        <span className="cos-progress-fill" style={{ width: `${Math.max(4, width)}%` }} />
      </div>
      <p style={{ fontSize: "12px", fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function SignalCard({ icon: Icon, title, value, description, href }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; value: string; description: string; href: string;
}) {
  return (
    <Link href={href} style={{ display: "block", padding: "12px", borderRadius: "var(--cos-r-lg)", border: "1px solid var(--cos-border)", background: "rgba(255,255,255,0.02)", textDecoration: "none", transition: "all 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div className="cos-metric-icon" style={{ width: "28px", height: "28px" }}><Icon /></div>
        <ArrowRight style={{ width: 12, height: 12, color: "var(--cos-text-tertiary)", marginLeft: "auto" }} />
      </div>
      <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)" }}>{title}</p>
      <p style={{ fontSize: "18px", fontWeight: 800, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>{description}</p>
    </Link>
  );
}

function BreakdownPanel({ title, rows, emptyText = "No data yet." }: {
  title: string;
  rows: Array<{ label: string; orders: number; revenue: number; width: number }>;
  emptyText?: string;
}) {
  return (
    <div className="cos-section">
      <div className="cos-section-header">
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700 }}>{title}</h3>
          <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>Share by order count and revenue</p>
        </div>
      </div>
      <div style={{ display: "grid", gap: "12px", padding: "14px" }}>
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600 }}>{row.label}</p>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--cos-text-tertiary)" }}>{row.orders} orders</p>
            </div>
            <div className="cos-progress-track" style={{ marginTop: "4px", height: "5px" }}>
              <span className="cos-progress-fill" style={{ width: `${Math.max(5, row.width)}%` }} />
            </div>
            <p style={{ fontSize: "10px", color: "var(--cos-text-tertiary)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>{money(row.revenue)}</p>
          </div>
        )) : <p style={{ fontSize: "12px", color: "var(--cos-text-tertiary)" }}>{emptyText}</p>}
      </div>
    </div>
  );
}

function RankRow({ rank, title, meta, value, icon: Icon }: {
  rank: number; title: string; meta: string; value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="cos-row">
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <span style={{ width: "28px", height: "28px", borderRadius: "var(--cos-r)", border: "1px solid var(--cos-border)", display: "grid", placeItems: "center", fontSize: "10px", fontWeight: 700, color: "var(--cos-text-tertiary)", flexShrink: 0 }}>{rank}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <Icon style={{ width: 13, height: 13, color: "var(--cos-text-tertiary)", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </p>
          <p style={{ fontSize: "10px", color: "var(--cos-text-tertiary)" }}>{meta}</p>
        </div>
      </div>
      <p style={{ flexShrink: 0, fontSize: "12px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p style={{ padding: "20px", fontSize: "12px", color: "var(--cos-text-tertiary)", textAlign: "center" }}>{text}</p>;
}

function getAddressValue(address: Record<string, unknown> | null, key: string) {
  const value = address?.[key];
  return value ? String(value) : "";
}
function isCancelled(order: ReturnType<typeof normalizeOrder>) { return order.orderStatus === "cancelled"; }
function normalizeToken(value: string) { return value.toLowerCase().replace(/\s+/g, "_"); }
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()); }
function toNumber(value: number | string | null | undefined) { const p = Number(value ?? 0); return Number.isFinite(p) ? p : 0; }
function sum<T extends { total: number }>(rows: T[], key: "total") { return rows.reduce((t, r) => t + r[key], 0); }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const n = new Date(date); n.setDate(n.getDate() + days); return n; }
function dateKey(date: Date) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
function formatDate(date: Date) { return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
function money(value: number) { return rupeeFormatter.format(Math.round(value)); }
function percent(value: number) { const prefix = value > 0 ? "+" : ""; return `${prefix}${Math.round(value)}%`; }
const rupeeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
