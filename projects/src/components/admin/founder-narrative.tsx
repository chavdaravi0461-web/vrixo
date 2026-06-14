"use client";

import { IndianRupee, ShoppingCart, Users, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";

function improve(revenue: number, growth: number): string {
  if (revenue === 0) return "Your store is live and ready for its first transaction. Create products and share your store to start generating revenue.";
  if (growth > 20) return "Momentum is accelerating. Revenue velocity exceeds expectations — consider increasing ad spend and inventory for your top performers.";
  if (growth > 0) return "Steady positive trajectory. Your business is growing. Focus on customer retention and repeat purchase incentives to compound this growth.";
  if (growth === 0) return "Revenue is stable. Explore new acquisition channels, promotions, or product launches to break through to the next growth tier.";
  return "Revenue is declining. Audit your customer acquisition funnel, check for cart abandonment issues, and consider temporary promotions to reverse the trend.";
}

function systemNote(health: number, pending: number, alerts: number): { message: string; type: string } {
  if (health >= 90) return { message: "All systems optimal. Your business is operating at peak efficiency.", type: "optimal" };
  if (health >= 70) return { message: "Minor attention points detected. Address pending items to restore full efficiency.", type: "attentive" };
  if (health >= 40) return { message: "Multiple areas need attention. Prioritize pending orders and system alerts.", type: "warning" };
  return { message: "Critical issues require immediate action. Focus on pending orders and system health.", type: "critical" };
}

function dayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function FoundersBrief({
  todayRevenue, todayOrders, totalRevenue, totalOrders, totalUsers, pendingOrders, alertCount, healthScore, revenueGrowth,
}: {
  todayRevenue: number; todayOrders: number; totalRevenue: number; totalOrders: number; totalUsers: number;
  pendingOrders: number; alertCount: number; healthScore: number; revenueGrowth: number;
}) {
  const sys = systemNote(healthScore, pendingOrders, alertCount);
  const narrative = improve(todayRevenue, revenueGrowth);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--os-border)] bg-gradient-to-br from-[var(--os-surface)] via-[var(--os-surface)] to-[rgba(99,102,241,0.03)] p-5 md:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gradient-to-br from-indigo-500/5 to-violet-500/5 blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </span>
              <span className="rounded-full bg-[var(--os-accent-soft)] px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-[var(--os-accent)]">
                OMEGA ∞ CORE
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                CONSCIOUS
              </span>
            </div>
            <h1 className="text-xl font-black leading-tight text-white md:text-2xl">
              {dayGreeting()}, Founder.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--os-text-2)]">
              {narrative}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard-admin-vrixo-ravi/products" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:opacity-90">
                <IndianRupee className="h-3 w-3" /> New Product
              </Link>
              <Link href="/dashboard-admin-vrixo-ravi/orders" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--os-border)] bg-[var(--os-surface-2)] px-3 py-1.5 text-[10px] font-bold text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-white">
                <ShoppingCart className="h-3 w-3" /> Order War Room
              </Link>
              <Link href="/dashboard-admin-vrixo-ravi/enterprise" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--os-border)] bg-[var(--os-surface-2)] px-3 py-1.5 text-[10px] font-bold text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-white">
                <TrendingUp className="h-3 w-3" /> Enterprise Ops
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 sm:flex-nowrap sm:text-right">
            <div className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)] px-4 py-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)]">Today</p>
              <p className="mt-1 text-lg font-black text-white tabular-nums">
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(todayRevenue)}
              </p>
              <p className="text-[10px] text-[var(--os-text-3)]">{todayOrders} orders</p>
            </div>
            <div className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface-2)] px-4 py-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--os-text-3)]">Health</p>
              <p className="mt-1 text-lg font-black text-white">{healthScore}%</p>
              <p className="text-[10px] text-[var(--os-text-3)]">{sys.message.slice(0, 40)}...</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
