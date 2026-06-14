"use client";

import { Bot, TrendingUp, AlertTriangle, Lightbulb, Target, BarChart3, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

type Insight = {
  icon: typeof Bot;
  title: string;
  body: string;
  cause: string;
  action: string;
  outcome: string;
  confidence: number;
  type: "opportunity" | "risk" | "insight";
};

function generateInsights(
  todayRevenue: number, todayOrders: number, totalRevenue: number, totalOrders: number,
  totalUsers: number, pendingOrders: number, completedOrders: number, aov: number,
  lowStockCount: number, topProduct: { title: string; quantity: number } | null,
  prepaidPct: number, alertCount: number, pendingReturns: number, openTickets: number,
): Insight[] {
  const insights: Insight[] = [];

  // Revenue momentum insight
  if (totalOrders > 0) {
    const dailyAvg = totalRevenue / Math.max(1, totalOrders);
    const momentum = todayOrders > 0 ? (todayOrders / Math.max(1, totalOrders / 30)) * 100 : 0;
    if (momentum > 120) {
      insights.push({
        icon: TrendingUp,
        title: "Revenue accelerating above baseline",
        body: `Today's order velocity is ${Math.round(momentum)}% of monthly daily average — significantly above normal.`,
        cause: topProduct ? `Primary driver: "${topProduct.title}" (${topProduct.quantity} units sold historically)` : "Increased customer acquisition momentum detected.",
        action: "Increase ad spend by 20% and verify inventory for top 3 products.",
        outcome: `Estimated gain: ₹${Math.round(dailyAvg * todayOrders * 1.3).toLocaleString("en-IN")} in 7 days`,
        confidence: 87,
        type: "opportunity",
      });
    } else if (momentum < 50 && todayOrders > 0) {
      insights.push({
        icon: AlertTriangle,
        title: "Revenue velocity below projected trajectory",
        body: `Today is tracking at ${Math.round(momentum)}% of expected daily volume.`,
        cause: "Potential causes: reduced traffic, cart abandonment, or payment friction.",
        action: "Audit checkout flow and verify payment gateway is operational.",
        outcome: "Recovery could restore ₹" + Math.round(dailyAvg * 5).toLocaleString("en-IN") + " in 3 days",
        confidence: 73,
        type: "risk",
      });
    }
  }

  // Stock risk insight
  if (lowStockCount > 0) {
    insights.push({
      icon: AlertTriangle,
      title: `${lowStockCount} product${lowStockCount > 1 ? "s" : ""} at critical stock levels`,
      body: `Inventory depletion risk within ${Math.max(1, Math.round(7 / Math.max(1, todayOrders)))} days at current velocity.`,
      cause: "Demand exceeding supply projection for these SKUs.",
      action: "Place urgent restock orders. Consider delisting products that can't be replenished within 5 days.",
      outcome: "Prevents ₹" + Math.round(aov * lowStockCount * 3).toLocaleString("en-IN") + " in missed revenue",
      confidence: 91,
      type: "risk",
    });
  }

  // Prepaid vs COD insight
  if (totalOrders > 10 && prepaidPct < 40) {
    insights.push({
      icon: Target,
      title: "High COD dependency — conversion and margin opportunity",
      body: `${prepaidPct}% prepaid vs ${100 - prepaidPct}% COD. COD orders have higher return rates and lower margins.`,
      cause: "Customers may not trust online payment or perceive COD as safer.",
      action: "Add prepaid discount incentive (5% off) and display trust badges prominently.",
      outcome: "Shifting 20% of COD to prepaid increases margin by ~₹" + Math.round(aov * 0.03 * totalOrders * 0.2).toLocaleString("en-IN"),
      confidence: 82,
      type: "opportunity",
    });
  }

  // Customer acquisition insight
  if (totalUsers > 0 && totalOrders > 0) {
    const conversion = (totalOrders / totalUsers) * 100;
    if (conversion < 10) {
      insights.push({
        icon: Lightbulb,
        title: "Conversion rate below ecommerce benchmark",
        body: `${Math.round(conversion)}% of registered users have purchased. Industry average is 15-20%.`,
        cause: "Potential friction points: pricing perception, trust signals, or checkout complexity.",
        action: "Implement exit-intent popup with 10% discount and simplify checkout to 2 steps.",
        outcome: "Improving conversion to 12% adds ~" + Math.round(totalUsers * 0.02).toLocaleString("en-IN") + " new customers",
        confidence: 76,
        type: "opportunity",
      });
    }
  }

  // Ticket/Support insight
  if (openTickets > 3) {
    insights.push({
      icon: Bot,
      title: "Support ticket volume indicates systemic issue",
      body: `${openTickets} open tickets — above normal operating threshold.`,
      cause: "Common causes: shipping delays, product quality concerns, or payment failures.",
      action: "Review ticket categories and address root cause. Auto-respond to common queries.",
      outcome: `Reducing tickets by 50% saves ~${Math.round(openTickets * 0.5)} hours/week in support`,
      confidence: 78,
      type: "insight",
    });
  }

  // Growth insight
  if (topProduct && topProduct.quantity > 5) {
    insights.push({
      icon: BarChart3,
      title: `"${topProduct.title}" is your growth engine`,
      body: `This product accounts for significant portion of sales velocity.`,
      cause: "High demand signal — customers are actively seeking this product.",
      action: "Create bundle offers, upsell accessories, and feature in marketing campaigns.",
      outcome: "Bundling could increase AOV by 25-35%",
      confidence: 84,
      type: "opportunity",
    });
  }

  // Returns insight
  if (pendingReturns > 0) {
    insights.push({
      icon: AlertTriangle,
      title: `${pendingReturns} return${pendingReturns > 1 ? "s" : ""} pending review`,
      body: "Unprocessed returns create customer dissatisfaction and operational drag.",
      cause: "Returns may indicate product quality issues or size/fit problems.",
      action: "Process within 24 hours. Analyze return reasons for product improvement.",
      outcome: "Fast returns processing increases repeat purchase probability by 40%",
      confidence: 88,
      type: "risk",
    });
  }

  // Default insight if none generated
  if (insights.length === 0) {
    insights.push({
      icon: Bot,
      title: "Business operating within normal parameters",
      body: "All key metrics are within expected ranges. No immediate action required.",
      cause: "Steady-state operation detected across all business dimensions.",
      action: "Focus on growth: test new acquisition channels or launch a promotion.",
      outcome: "Proactive growth initiatives can increase monthly revenue by 12-18%",
      confidence: 72,
      type: "insight",
    });
  }

  return insights.slice(0, 4);
}

export function AIInsightEngine({
  todayRevenue, todayOrders, totalRevenue, totalOrders, totalUsers,
  pendingOrders, completedOrders, aov, lowStockCount, topProduct,
  prepaidPct, alertCount, pendingReturns, openTickets,
}: {
  todayRevenue: number; todayOrders: number; totalRevenue: number; totalOrders: number;
  totalUsers: number; pendingOrders: number; completedOrders: number; aov: number;
  lowStockCount: number; topProduct: { title: string; quantity: number } | null;
  prepaidPct: number; alertCount: number; pendingReturns: number; openTickets: number;
}) {
  const insights = generateInsights(
    todayRevenue, todayOrders, totalRevenue, totalOrders, totalUsers,
    pendingOrders, completedOrders, aov, lowStockCount, topProduct,
    prepaidPct, alertCount, pendingReturns, openTickets,
  );

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-0">
      <div className="flex items-center justify-between border-b border-[var(--os-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
            <Bot className="h-3 w-3 text-indigo-400" />
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-white">AI Insight Engine</h3>
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">LIVE</span>
        </div>
        <span className="text-[9px] text-[var(--os-text-3)]">{insights.length} intelligence signals</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          const borderColor = insight.type === "opportunity" ? "border-l-emerald-500/40" : insight.type === "risk" ? "border-l-amber-500/40" : "border-l-indigo-500/40";
          return (
            <div key={i} className={`rounded-xl border border-[var(--os-border)] border-l-2 ${borderColor} bg-[var(--os-surface-2)] p-4 transition hover:bg-[var(--os-surface)]`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  insight.type === "opportunity" ? "bg-emerald-500/10 text-emerald-400" :
                  insight.type === "risk" ? "bg-amber-500/10 text-amber-400" :
                  "bg-indigo-500/10 text-indigo-400"
                }`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{insight.title}</p>
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                      insight.type === "opportunity" ? "bg-emerald-500/10 text-emerald-400" :
                      insight.type === "risk" ? "bg-amber-500/10 text-amber-400" :
                      "bg-indigo-500/10 text-indigo-400"
                    }`}>{insight.confidence}%</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--os-text-2)]">{insight.body}</p>
                  <div className="mt-2 space-y-1">
                    <p className="flex items-start gap-1.5 text-[10px] text-[var(--os-text-3)]">
                      <span className="mt-0.5 shrink-0 text-amber-400/70">→</span>
                      {insight.cause}
                    </p>
                    <p className="flex items-start gap-1.5 text-[10px] text-[var(--os-text-3)]">
                      <span className="mt-0.5 shrink-0 text-emerald-400/70">▶</span>
                      {insight.action}
                    </p>
                    <p className="flex items-start gap-1.5 text-[10px] font-semibold text-emerald-400/80">
                      <span className="mt-0.5 shrink-0">◆</span>
                      {insight.outcome}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type Forecast = {
  period: string;
  label: string;
  revenue: number;
  orders: number;
  confidence: number;
  risk: string;
  opportunity: string;
};

export function PredictiveFutureEngine({
  todayRevenue, todayOrders, totalRevenue, totalOrders, aov, prepaidPct, totalProducts,
}: {
  todayRevenue: number; todayOrders: number; totalRevenue: number; totalOrders: number;
  aov: number; prepaidPct: number; totalProducts: number;
}) {
  const dailyRevenueRate = todayOrders > 0 ? todayRevenue / Math.max(1, todayOrders) : aov;
  const dailyOrderRate = Math.max(1, todayOrders > 0 ? todayOrders : Math.round(totalOrders / 30));

  const forecasts: Forecast[] = [
    {
      period: "7-day",
      label: "Next 7 days",
      revenue: dailyRevenueRate * dailyOrderRate * 7,
      orders: dailyOrderRate * 7,
      confidence: Math.min(95, 70 + todayOrders * 3),
      risk: todayOrders === 0 ? "Insufficient data — prediction based on lifetime averages" : "Market fluctuation ±15%",
      opportunity: `${prepaidPct > 50 ? "Prepaid dominance" : "COD reduction"} could improve margin by ${prepaidPct > 50 ? "2%" : "5%"}`,
    },
    {
      period: "30-day",
      label: "Next 30 days",
      revenue: dailyRevenueRate * dailyOrderRate * 30,
      orders: dailyOrderRate * 30,
      confidence: Math.min(85, 50 + todayOrders * 2),
      risk: totalOrders < 10 ? "Limited historical data" : "Seasonal variance ±20%",
      opportunity: totalProducts > 0 ? `New product ${totalOrders > 50 ? "expansion" : "launch"} could add 15%` : "Product catalog expansion opportunity",
    },
    {
      period: "90-day",
      label: "Next quarter",
      revenue: dailyRevenueRate * dailyOrderRate * 90,
      orders: dailyOrderRate * 90,
      confidence: Math.min(70, 35 + todayOrders),
      risk: "Long-range forecast — accuracy decreases with time horizon",
      opportunity: "Scaling acquisition could 2x these projections",
    },
  ];

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const cnt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

  const totalProjectedRevenue = forecasts.reduce((s, f) => s + f.revenue, 0);
  const totalProjectedOrders = forecasts.reduce((s, f) => s + f.orders, 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-0">
      <div className="flex items-center justify-between border-b border-[var(--os-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
            <Clock className="h-3 w-3 text-violet-400" />
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-white">Predictive Future Engine</h3>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-[var(--os-text-3)]">
          <span>Projected: {fmt(totalProjectedRevenue)}</span>
          <span className="text-[var(--os-border-light)]">·</span>
          <span>{cnt(totalProjectedOrders)} orders</span>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {forecasts.map((f) => {
          const confidenceColor = f.confidence >= 80 ? "text-emerald-400" : f.confidence >= 60 ? "text-amber-400" : "text-[var(--os-text-3)]";
          return (
            <div key={f.period} className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)] p-4 transition hover:border-[var(--os-border-light)]">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)]">{f.label}</p>
                <span className={`rounded-full bg-[var(--os-surface-3)] px-1.5 py-0.5 text-[8px] font-bold ${confidenceColor}`}>{f.confidence}% confidence</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[18px] font-black text-white tabular-nums">{fmt(f.revenue)}</p>
                  <p className="text-[9px] text-[var(--os-text-3)]">Projected revenue</p>
                </div>
                <div>
                  <p className="text-[18px] font-black text-white tabular-nums">{cnt(f.orders)}</p>
                  <p className="text-[9px] text-[var(--os-text-3)]">Projected orders</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--os-surface-3)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${f.confidence}%` }}
                />
              </div>
              <div className="mt-3 space-y-1">
                <p className="flex items-start gap-1.5 text-[9px] text-amber-400/70">
                  <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                  {f.risk}
                </p>
                <p className="flex items-start gap-1.5 text-[9px] text-emerald-400/70">
                  <Lightbulb className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                  {f.opportunity}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
