"use client";

import { useEffect, useState } from "react";
import { MessageSquare, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";

type WhatsAppStats = {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  deliveryRate: number;
  apiStatus: "ok" | "degraded" | "down";
  lastSuccessAt: string | null;
  lastFailedAt: string | null;
  lastErrorMessage: string | null;
  recentMessages: Array<{
    id: string;
    orderNumber: string;
    status: string;
    error: string | null;
    sentAt: string;
    phoneSuffix: string;
  }>;
};

export function WhatsAppMonitor() {
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/whatsapp/stats");
      if (!res.ok) throw new Error("Failed to fetch WhatsApp stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading WhatsApp status...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900">WhatsApp Automation</h3>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={CheckCircle}
          label="Sent"
          value={stats.totalSent.toLocaleString()}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          icon={XCircle}
          label="Failed"
          value={stats.totalFailed.toLocaleString()}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.totalPending.toLocaleString()}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          icon={TrendingUp}
          label="Delivery Rate"
          value={`${(stats.deliveryRate * 100).toFixed(1)}%`}
          color={stats.deliveryRate > 0.9 ? "text-emerald-600" : "text-amber-600"}
          bg="bg-slate-50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          API: <StatusDot status={stats.apiStatus} />
          {stats.apiStatus === "ok" ? "Operational" : stats.apiStatus === "degraded" ? "Degraded" : "Down"}
        </span>
        {stats.lastSuccessAt && (
          <span>Last success: {new Date(stats.lastSuccessAt).toLocaleString()}</span>
        )}
        {stats.lastFailedAt && (
          <span className="text-red-500">
            Last failure: {new Date(stats.lastFailedAt).toLocaleString()}
            {stats.lastErrorMessage && ` — ${stats.lastErrorMessage}`}
          </span>
        )}
      </div>

      {stats.recentMessages.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent deliveries</p>
          <div className="space-y-1">
            {stats.recentMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-700">#{msg.orderNumber}</span>
                <span className="text-slate-400">***{msg.phoneSuffix}</span>
                <span className={msg.status === "sent" ? "text-emerald-600" : "text-red-600"}>
                  {msg.status === "sent" ? "Sent" : "Failed"}
                </span>
                <span className="text-slate-400">
                  {new Date(msg.sentAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-md border border-slate-200 p-3 ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: WhatsAppStats["apiStatus"] }) {
  const colors = { ok: "bg-emerald-500", degraded: "bg-amber-500", down: "bg-red-500" };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
}
