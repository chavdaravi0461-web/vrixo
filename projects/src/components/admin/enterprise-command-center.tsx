"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CreditCard,
  Gauge,
  HeartPulse,
  MessageCircle,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Zap
} from "lucide-react";

type EnterpriseOverview = {
  health: Record<string, boolean | string>;
  metrics: {
    orders24h: number;
    revenue24h: number;
    behavior24h: number;
    webhook24h: number;
    pendingNotifications: number;
    failedNotifications: number;
  };
  events: LiveEvent[];
};

type LiveEvent = {
  id?: string;
  type: string;
  severity?: "info" | "warn" | "critical";
  entityId?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: string;
};

export function EnterpriseCommandCenter({ initial }: { initial: EnterpriseOverview }) {
  const [overview, setOverview] = useState(initial);
  const [events, setEvents] = useState<LiveEvent[]>(initial.events ?? []);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/admin/realtime/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as LiveEvent;
      if (event.type === "heartbeat" || event.type === "connected") return;
      setEvents((current) => [event, ...current.filter((row) => row.id !== event.id)].slice(0, 80));
    };
    return () => source.close();
  }, []);

  async function refresh() {
    const response = await fetch("/api/admin/enterprise/overview", { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as EnterpriseOverview;
    setOverview(next);
    setEvents(next.events ?? []);
  }

  const riskEvents = useMemo(() => events.filter((event) => ["fraud.alert", "payment.blocked", "payment.risk_review"].includes(event.type)), [events]);
  const revenue = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(overview.metrics.revenue24h);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black text-white shadow-2xl shadow-black/30">
        <div className="relative min-h-[330px] bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.24),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(135deg,#020617,#050505_55%,#111827)] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
                <Radio className="h-4 w-4" />
                {connected ? "Live infrastructure online" : "Realtime reconnecting"}
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
                VRIXO autonomous enterprise command.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Fraud decisions, revenue movement, customer intent, WhatsApp delivery, queues, webhooks, and AI signals from the production event bus.
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-black"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric icon={ShoppingCart} label="Orders 24h" value={overview.metrics.orders24h} />
            <HeroMetric icon={CreditCard} label="Revenue 24h" value={revenue} />
            <HeroMetric icon={Activity} label="Behavior events" value={overview.metrics.behavior24h} />
            <HeroMetric icon={ShieldAlert} label="Risk events" value={riskEvents.length} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <HealthTile label="Redis" value={String(overview.health.redis)} icon={Zap} />
        <HealthTile label="Sentry" value={overview.health.sentry ? "configured" : "missing"} icon={HeartPulse} />
        <HealthTile label="AI" value={overview.health.ai ? "enabled" : "disabled"} icon={Brain} />
        <HealthTile label="WhatsApp" value={overview.health.whatsapp ? "enabled" : "disabled"} icon={MessageCircle} />
        <HealthTile label="Razorpay" value={overview.health.razorpay ? "enabled" : "disabled"} icon={CreditCard} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950 text-white shadow-xl shadow-black/20">
          <PanelTitle icon={Radio} title="Live event stream" subtitle="Event-driven activity from orders, fraud, WhatsApp, behavior, queues, and webhooks." />
          <div className="max-h-[560px] divide-y divide-white/10 overflow-y-auto">
            {events.length ? events.map((event, index) => <EventRow key={event.id ?? `${event.type}-${index}`} event={event} />) : (
              <p className="p-6 text-sm font-semibold text-slate-400">No enterprise events recorded yet.</p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-slate-800 bg-black p-5 text-white shadow-xl shadow-black/20">
            <PanelTitle icon={ShieldAlert} title="Fraud intelligence" subtitle="Razorpay/COD risk engine decisions." compact />
            <div className="mt-4 space-y-3">
              {riskEvents.slice(0, 5).map((event, index) => <RiskCard key={event.id ?? index} event={event} />)}
              {!riskEvents.length ? <p className="text-sm font-semibold text-slate-400">No high-risk decisions in the current event window.</p> : null}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-800 bg-black p-5 text-white shadow-xl shadow-black/20">
            <PanelTitle icon={Gauge} title="Operations pressure" subtitle="Queues, notifications, and webhook flow." compact />
            <div className="mt-5 grid gap-3">
              <PressureRow label="Pending notifications" value={overview.metrics.pendingNotifications} tone="warn" />
              <PressureRow label="Failed notifications" value={overview.metrics.failedNotifications} tone="critical" />
              <PressureRow label="Razorpay webhooks 24h" value={overview.metrics.webhook24h} tone="info" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
      <Icon className="h-5 w-5 text-amber-200" />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function HealthTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  const ok = ["online", "configured", "enabled", "true"].includes(value);
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white">
      <div className="flex items-center justify-between">
        <Icon className={ok ? "h-5 w-5 text-emerald-300" : "h-5 w-5 text-amber-300"} />
        <span className={ok ? "h-2.5 w-2.5 rounded-full bg-emerald-300" : "h-2.5 w-2.5 rounded-full bg-amber-300"} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black capitalize">{value}</p>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, subtitle, compact = false }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={compact ? "" : "border-b border-white/10 p-5"}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10">
          <Icon className="h-5 w-5 text-amber-200" />
        </span>
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: LiveEvent }) {
  const severity = event.severity ?? "info";
  const color = severity === "critical" ? "text-red-300" : severity === "warn" ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[140px_1fr_auto] md:items-center">
      <p className={`text-xs font-black uppercase tracking-[0.14em] ${color}`}>{event.type}</p>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{String(event.payload?.orderNumber ?? event.entityId ?? event.payload?.path ?? "system event")}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{JSON.stringify(event.payload ?? {})}</p>
      </div>
      <p className="text-xs font-semibold text-slate-500">{event.createdAt ? new Date(event.createdAt).toLocaleTimeString("en-IN") : "live"}</p>
    </div>
  );
}

function RiskCard({ event }: { event: LiveEvent }) {
  return (
    <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-red-200">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-sm font-black">{event.type}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">{JSON.stringify(event.payload ?? {})}</p>
    </div>
  );
}

function PressureRow({ label, value, tone }: { label: string; value: number; tone: "warn" | "critical" | "info" }) {
  const color = tone === "critical" ? "bg-red-400" : tone === "warn" ? "bg-amber-300" : "bg-sky-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-slate-300">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(6, value * 8))}%` }} />
      </div>
    </div>
  );
}

