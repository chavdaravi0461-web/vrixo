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
    <AdminShell current="/dashboard-admin-dreamcart-ravi/analytics">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
              Sales intelligence
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
              Sales analytics
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              Revenue, payment health, fulfillment pressure, product winners, and customer signals from the latest 1,000 captured orders.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
            <HeroMetric label="Today revenue" value={money(analytics.todayRevenue)} />
            <HeroMetric label="30 day revenue" value={money(analytics.last30Revenue)} />
            <HeroMetric label="AOV" value={money(analytics.averageOrderValue)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BadgeIndianRupee} label="Net sales" value={money(analytics.netRevenue)} hint={`${analytics.saleOrders} sale orders`} tone="dark" />
        <MetricCard icon={TrendingUp} label="30 day growth" value={percent(analytics.growthRate)} hint={`${money(analytics.previous30Revenue)} previous 30 days`} tone={analytics.growthRate >= 0 ? "success" : "warn"} />
        <MetricCard icon={ShoppingBag} label="Orders today" value={analytics.todayOrders} hint={`${analytics.pendingOrders} pending now`} tone="info" />
        <MetricCard icon={Target} label="Avg order value" value={money(analytics.averageOrderValue)} hint={`${money(analytics.bestOrderTotal)} highest order`} tone="gold" />
        <MetricCard icon={CreditCard} label="Online paid" value={analytics.paidOrders} hint={money(analytics.onlinePaidRevenue)} tone="success" />
        <MetricCard icon={Banknote} label="COD load" value={analytics.codOrders} hint={money(analytics.codRevenue)} tone="default" />
        <MetricCard icon={Truck} label="In fulfillment" value={analytics.fulfillmentOrders} hint="Processing, packed, or shipped" tone="info" />
        <MetricCard icon={AlertTriangle} label="At risk" value={analytics.riskOrders} hint={`${money(analytics.riskRevenue)} exposed`} tone="warn" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section className="admin-card overflow-hidden">
          <PanelHeader title="14 day sales pulse" description="Daily order volume and revenue trend." />
          <div className="grid gap-5 p-5">
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
        </section>

        <section className="admin-card overflow-hidden">
          <PanelHeader title="Control tower" description="Signals that need admin attention." />
          <div className="grid gap-3 p-5">
            <SignalCard
              icon={AlertTriangle}
              title="Pending order value"
              value={money(analytics.pendingRevenue)}
              description={`${analytics.pendingOrders} orders still need confirmation or processing.`}
              href="/dashboard-admin-dreamcart-ravi/orders?order_status=pending"
            />
            <SignalCard
              icon={CreditCard}
              title="Failed payment value"
              value={money(analytics.failedPaymentRevenue)}
              description={`${analytics.failedPaymentOrders} failed online payment orders to review.`}
              href="/dashboard-admin-dreamcart-ravi/orders?payment_status=failed"
            />
            <SignalCard
              icon={CheckCircle2}
              title="Delivered revenue"
              value={money(analytics.deliveredRevenue)}
              description={`${analytics.deliveredOrders} completed orders closed cleanly.`}
              href="/dashboard-admin-dreamcart-ravi/orders?order_status=delivered"
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <BreakdownPanel title="Payment mix" rows={analytics.paymentMix} />
        <BreakdownPanel title="Order status" rows={analytics.statusMix} />
        <BreakdownPanel title="Top delivery cities" rows={analytics.cityMix} emptyText="No city data yet." />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="admin-card overflow-hidden">
          <PanelHeader title="Best selling products" description="Ranked by quantity sold and revenue." />
          <div className="divide-y divide-slate-100">
            {analytics.topProducts.length ? (
              analytics.topProducts.map((product, index) => (
                <RankRow
                  key={product.key}
                  rank={index + 1}
                  title={product.title}
                  meta={`${product.quantity} sold`}
                  value={money(product.revenue)}
                  icon={Package}
                />
              ))
            ) : (
              <EmptyPanel text="No product sales yet." />
            )}
          </div>
        </section>

        <section className="admin-card overflow-hidden">
          <PanelHeader title="Top customers" description="Repeat buyers and high value customers." />
          <div className="divide-y divide-slate-100">
            {analytics.topCustomers.length ? (
              analytics.topCustomers.map((customer, index) => (
                <RankRow
                  key={customer.key}
                  rank={index + 1}
                  title={customer.name}
                  meta={`${customer.orders} orders`}
                  value={money(customer.revenue)}
                  icon={Users}
                />
              ))
            ) : (
              <EmptyPanel text="No customer data yet." />
            )}
          </div>
        </section>
      </div>

      <section className="admin-card mt-6 overflow-hidden">
        <PanelHeader title="Latest high value orders" description="Recent orders sorted by highest totals." />
        <div className="divide-y divide-slate-100">
          {analytics.highValueOrders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard-admin-dreamcart-ravi/orders?search=${encodeURIComponent(order.orderNumber)}`}
              className="grid gap-3 p-5 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {order.orderNumber}
                </p>
                <h3 className="mt-2 text-base font-bold text-slate-950">{order.customerName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(order.createdAt)} / {order.orderStatus} / {order.paymentStatus}
                </p>
              </div>
              <span className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
                {money(order.total)}
              </span>
            </Link>
          ))}
        </div>
      </section>
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
    netRevenue,
    saleOrders: saleOrders.length,
    todayRevenue: sum(saleOrders.filter((order) => dateKey(order.createdAt) === todayKey), "total"),
    todayOrders: saleOrders.filter((order) => dateKey(order.createdAt) === todayKey).length,
    last30Revenue,
    previous30Revenue,
    growthRate: previous30Revenue > 0 ? ((last30Revenue - previous30Revenue) / previous30Revenue) * 100 : last30Revenue > 0 ? 100 : 0,
    averageOrderValue: saleOrders.length ? netRevenue / saleOrders.length : 0,
    bestOrderTotal: Math.max(0, ...saleOrders.map((order) => order.total)),
    paidOrders: paidOrders.length,
    onlinePaidRevenue: sum(paidOrders.filter((order) => order.paymentMethod === "online"), "total"),
    codOrders: codOrders.length,
    codRevenue: sum(codOrders, "total"),
    pendingOrders: pendingOrders.length,
    pendingRevenue: sum(pendingOrders, "total"),
    fulfillmentOrders: fulfillmentOrders.length,
    failedPaymentOrders: failedPaymentOrders.length,
    failedPaymentRevenue: sum(failedPaymentOrders, "total"),
    deliveredOrders: deliveredOrders.length,
    deliveredRevenue: sum(deliveredOrders, "total"),
    riskOrders: riskOrders.length,
    riskRevenue: sum(riskOrders, "total"),
    dailyTrend,
    maxDailyRevenue: Math.max(0, ...dailyTrend.map((day) => day.revenue)),
    paymentMix,
    statusMix,
    cityMix,
    topProducts: buildTopProducts(saleOrders),
    topCustomers: buildTopCustomers(saleOrders),
    highValueOrders
  };
}

function normalizeOrder(order: OrderRow) {
  const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name || "Customer",
    customerKey: order.customer_phone || order.customer_email || order.customer_name || order.id,
    createdAt: new Date(order.created_at),
    subtotal: toNumber(order.subtotal),
    discount: toNumber(order.discount),
    shippingCharge: toNumber(order.shipping_charge),
    total: toNumber(order.total),
    paymentMethod: normalizeToken(order.payment_method || "cod"),
    paymentStatus: normalizeToken(order.payment_status || "pending"),
    orderStatus: normalizeToken(order.order_status || "pending"),
    city: getAddressValue(order.shipping_address, "city"),
    items
  };
}

function buildDailyTrend(orders: ReturnType<typeof normalizeOrder>[], now: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = startOfDay(addDays(now, index - 13));
    const key = dateKey(date);
    const dayOrders = orders.filter((order) => dateKey(order.createdAt) === key);

    return {
      key,
      label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      orders: dayOrders.length,
      revenue: sum(dayOrders, "total")
    };
  });
}

function buildBreakdown(orders: ReturnType<typeof normalizeOrder>[], labelFor: (order: ReturnType<typeof normalizeOrder>) => string) {
  const map = new Map<string, { label: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const label = labelFor(order);
    const current = map.get(label) ?? { label, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.total;
    map.set(label, current);
  });
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(1, ...rows.map((row) => row.revenue));
  return rows.map((row) => ({ ...row, width: (row.revenue / max) * 100 })).slice(0, 7);
}

function buildTopProducts(orders: ReturnType<typeof normalizeOrder>[]) {
  const map = new Map<string, { key: string; title: string; quantity: number; revenue: number }>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const title = String(item.title || "Product");
      const key = String(item.productId || title);
      const quantity = Number(item.quantity ?? 1);
      const price = Number(item.price ?? 0);
      const current = map.get(key) ?? { key, title, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += price * quantity;
      map.set(key, current);
    });
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function buildTopCustomers(orders: ReturnType<typeof normalizeOrder>[]) {
  const map = new Map<string, { key: string; name: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const current = map.get(order.customerKey) ?? { key: order.customerKey, name: order.customerName, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.total;
    map.set(order.customerKey, current);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">{label}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  tone: "dark" | "success" | "warn" | "info" | "gold" | "default";
}) {
  const toneClass = {
    dark: "bg-slate-950 text-white",
    success: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    info: "bg-sky-100 text-sky-800",
    gold: "bg-yellow-100 text-yellow-800",
    default: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <div className="admin-kpi p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <h2 className="mt-3 break-words text-2xl font-black text-slate-950 md:text-3xl">{value}</h2>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-slate-100 p-5">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function TrendRow({ label, value, sub, width }: { label: string; value: string; sub: string; width: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[96px_1fr_140px] sm:items-center">
      <div>
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{sub}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, width)}%` }} />
      </div>
      <p className="text-sm font-black text-slate-950 sm:text-right">{value}</p>
    </div>
  );
}

function SignalCard({
  icon: Icon,
  title,
  value,
  description,
  href
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-950 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-slate-800">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </Link>
  );
}

function BreakdownPanel({ title, rows, emptyText = "No data yet." }: { title: string; rows: Array<{ label: string; orders: number; revenue: number; width: number }>; emptyText?: string }) {
  return (
    <section className="admin-card overflow-hidden">
      <PanelHeader title={title} description="Share by order count and revenue." />
      <div className="grid gap-4 p-5">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-800">{row.label}</p>
              <p className="text-sm font-bold text-slate-500">{row.orders} orders</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(5, row.width)}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">{money(row.revenue)}</p>
          </div>
        )) : <EmptyPanel text={emptyText} compact />}
      </div>
    </section>
  );
}

function RankRow({
  rank,
  title,
  meta,
  value,
  icon: Icon
}: {
  rank: number;
  title: string;
  meta: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
        {rank}
      </span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 break-words font-bold text-slate-950">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{meta}</p>
      </div>
      <p className="text-sm font-black text-slate-950 sm:text-right">{value}</p>
    </div>
  );
}

function EmptyPanel({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={compact ? "text-sm font-semibold text-slate-500" : "p-6 text-sm font-semibold text-slate-500"}>{text}</p>;
}

function getAddressValue(address: Record<string, unknown> | null, key: string) {
  const value = address?.[key];
  return value ? String(value) : "";
}

function isCancelled(order: ReturnType<typeof normalizeOrder>) {
  return order.orderStatus === "cancelled";
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/\s+/g, "_");
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum<T extends { total: number }>(rows: T[], key: "total") {
  return rows.reduce((total, row) => total + row[key], 0);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function money(value: number) {
  return rupeeFormatter.format(Math.round(value));
}

function percent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Math.round(value)}%`;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
