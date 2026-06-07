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
    <AdminShell current="/dashboard-admin-vrixo-ravi/analytics">
      <section className="os-hero p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="os-dot live" />
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Sales Intelligence</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Analytics</h1>
              <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
                Revenue, payment health, fulfillment pressure, and product winners from the latest 1,000 orders.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <HeroMetric label="Today" value={money(analytics.todayRevenue)} />
              <HeroMetric label="30 day" value={money(analytics.last30Revenue)} />
              <HeroMetric label="AOV" value={money(analytics.averageOrderValue)} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={BadgeIndianRupee} label="Net Sales" value={money(analytics.netRevenue)} hint={`${analytics.saleOrders} orders`} color="indigo" />
        <Metric icon={TrendingUp} label="30 Day Growth" value={percent(analytics.growthRate)} hint={`${money(analytics.previous30Revenue)} prev 30d`} up={analytics.growthRate >= 0} color="emerald" />
        <Metric icon={ShoppingBag} label="Orders Today" value={analytics.todayOrders} hint={`${analytics.pendingOrders} pending`} up={false} color="rose" />
        <Metric icon={Target} label="Avg Order Value" value={money(analytics.averageOrderValue)} hint={`${money(analytics.bestOrderTotal)} highest`} color="violet" />
        <Metric icon={CreditCard} label="Online Paid" value={analytics.paidOrders} hint={money(analytics.onlinePaidRevenue)} color="emerald" />
        <Metric icon={Banknote} label="COD Load" value={analytics.codOrders} hint={money(analytics.codRevenue)} color="amber" />
        <Metric icon={Truck} label="In Fulfillment" value={analytics.fulfillmentOrders} hint="Processing, packed, shipped" color="sky" />
        <Metric icon={AlertTriangle} label="At Risk" value={analytics.riskOrders} hint={`${money(analytics.riskRevenue)} exposed`} up={false} color="rose" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>14 Day Sales Pulse</h3>
              <p>Daily order volume and revenue trend</p>
            </div>
          </div>
          <div className="grid gap-4 p-5">
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

        <div className="flex flex-col gap-5">
          <div className="os-card">
            <div className="os-card-header">
              <div>
                <h3>Control Tower</h3>
                <p>Signals needing attention</p>
              </div>
            </div>
            <div className="grid gap-3 p-4">
              <SignalCard
                icon={AlertTriangle}
                title="Pending Order Value"
                value={money(analytics.pendingRevenue)}
                description={`${analytics.pendingOrders} orders need confirmation.`}
                href="/dashboard-admin-vrixo-ravi/orders?order_status=pending"
              />
              <SignalCard
                icon={CreditCard}
                title="Failed Payment Value"
                value={money(analytics.failedPaymentRevenue)}
                description={`${analytics.failedPaymentOrders} failed payments.`}
                href="/dashboard-admin-vrixo-ravi/orders?payment_status=failed"
              />
              <SignalCard
                icon={CheckCircle2}
                title="Delivered Revenue"
                value={money(analytics.deliveredRevenue)}
                description={`${analytics.deliveredOrders} completed.`}
                href="/dashboard-admin-vrixo-ravi/orders?order_status=delivered"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <BreakdownPanel title="Payment Mix" rows={analytics.paymentMix} />
        <BreakdownPanel title="Order Status" rows={analytics.statusMix} />
        <BreakdownPanel title="Top Delivery Cities" rows={analytics.cityMix} emptyText="No city data yet." />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Best Selling Products</h3>
              <p>Ranked by quantity sold</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--os-border)]">
            {analytics.topProducts.length ? (
              analytics.topProducts.map((product, i) => (
                <RankRow key={product.key} rank={i + 1} title={product.title} meta={`${product.quantity} sold`} value={money(product.revenue)} icon={Package} />
              ))
            ) : (
              <EmptyPanel text="No product sales yet." />
            )}
          </div>
        </div>

        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Top Customers</h3>
              <p>Repeat buyers and high value</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--os-border)]">
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

      <div className="mt-5 os-card">
        <div className="os-card-header">
          <div>
            <h3>Latest High Value Orders</h3>
            <p>Recent orders by highest totals</p>
          </div>
          <Link href="/dashboard-admin-vrixo-ravi/orders" className="os-btn os-btn-ghost" style={{ padding: "4px 10px", fontSize: "10px" }}>
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-[var(--os-border)]">
          {analytics.highValueOrders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard-admin-vrixo-ravi/orders?search=${encodeURIComponent(order.orderNumber)}`}
              className="os-row flex items-center justify-between gap-3 px-4 py-3 md:px-5"
            >
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)]">{order.orderNumber}</p>
                <p className="text-sm font-semibold text-[var(--os-text)]">{order.customerName}</p>
                <p className="text-[10px] text-[var(--os-text-3)]">{formatDate(order.createdAt)} / {order.orderStatus} / {order.paymentStatus}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-white">{money(order.total)}</span>
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
    <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--os-border)", borderRadius: "9px", padding: "10px" }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--os-text-3)]">{label}</p>
      <p className="mt-2 text-lg font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

const colorGlow: Record<string, string> = {
  indigo: 'rgba(99,102,241,0.04)', emerald: 'rgba(16,185,129,0.04)',
  rose: 'rgba(244,63,94,0.04)', violet: 'rgba(139,92,246,0.04)',
  amber: 'rgba(245,158,11,0.04)', sky: 'rgba(6,182,212,0.04)',
};

function Metric({ icon: Icon, label, value, hint, up, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; hint: string;
  up?: boolean; color: string;
}) {
  return (
    <div className="os-metric">
      <div className="m-glow" style={{ background: colorGlow[color] || 'var(--os-accent)', opacity: 0.08 }} />
      <div className="m-top">
        <div>
          <div className="m-label">{label}</div>
          <div className="m-value">{value}</div>
          <div className={`m-trend ${up === undefined ? 'neutral' : up ? 'up' : 'down'}`}>
            {up !== undefined ? (up ? '↑' : '↓') : '—'} {hint}
          </div>
        </div>
        <div className="m-icon" style={{ background: 'var(--os-accent-soft)', color: 'var(--os-accent)' }}>
          <Icon className="h-[15px] w-[15px]" />
        </div>
      </div>
    </div>
  );
}

function TrendRow({ label, value, sub, width }: { label: string; value: string; sub: string; width: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[90px_1fr_130px] sm:items-center">
      <div>
        <p className="text-sm font-bold text-[var(--os-text)]">{label}</p>
        <p className="text-[10px] text-[var(--os-text-3)]">{sub}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--os-surface-3)]">
        <div className="h-full rounded-full bg-gradient-to-r from-[var(--os-accent)] to-[var(--os-success)]" style={{ width: `${Math.max(4, width)}%` }} />
      </div>
      <p className="text-sm font-bold text-white sm:text-right tabular-nums">{value}</p>
    </div>
  );
}

function SignalCard({ icon: Icon, title, value, description, href }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; value: string; description: string; href: string;
}) {
  return (
    <Link href={href} className="group block rounded-[var(--os-radius-sm)] border border-[var(--os-border)] bg-[rgba(255,255,255,0.012)] p-3 transition hover:border-[var(--os-border-light)]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--os-accent-soft)] text-[var(--os-accent)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <ArrowRight className="h-3 w-3 text-[var(--os-text-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--os-text)]" />
      </div>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--os-text-3)]">{title}</p>
      <p className="mt-1 text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] leading-5 text-[var(--os-text-3)]">{description}</p>
    </Link>
  );
}

function BreakdownPanel({ title, rows, emptyText = "No data yet." }: {
  title: string;
  rows: Array<{ label: string; orders: number; revenue: number; width: number }>;
  emptyText?: string;
}) {
  return (
    <div className="os-card">
      <div className="os-card-header">
        <div>
          <h3>{title}</h3>
          <p>Share by order count and revenue</p>
        </div>
      </div>
      <div className="grid gap-4 p-4">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[var(--os-text)]">{row.label}</p>
              <p className="text-[10px] font-semibold text-[var(--os-text-3)]">{row.orders} orders</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--os-surface-3)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--os-accent)] to-[var(--os-accent)]" style={{ width: `${Math.max(5, row.width)}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--os-text-3)] tabular-nums">{money(row.revenue)}</p>
          </div>
        )) : <p className="text-sm text-[var(--os-text-3)]">{emptyText}</p>}
      </div>
    </div>
  );
}

function RankRow({ rank, title, meta, value, icon: Icon }: {
  rank: number; title: string; meta: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="os-row flex items-center justify-between gap-3 px-4 py-3 md:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--os-surface-3)] text-[10px] font-bold text-[var(--os-text-3)]">{rank}</span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--os-text)]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--os-text-3)]" />
            <span className="truncate">{title}</span>
          </p>
          <p className="text-[10px] text-[var(--os-text-3)]">{meta}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="p-5 text-sm text-[var(--os-text-3)]">{text}</p>;
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
