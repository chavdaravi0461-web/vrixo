"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = { created_at: string; total: number };

function aggregate(data: DataPoint[]): { date: string; revenue: number }[] {
  if (!data?.length) return [];
  const map = new Map<string, number>();
  for (const d of data) {
    const day = d.created_at?.slice(0, 10);
    if (day) map.set(day, (map.get(day) || 0) + Number(d.total || 0));
  }
  return Array.from(map.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function RevenueChart({ data }: { data: DataPoint[] }) {
  const chartData = aggregate(data);
  if (!chartData.length) {
    return <div className="flex h-[180px] items-center justify-center text-xs text-[var(--ai-text-muted)]">No revenue data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
          tickLine={false} axisLine={false}
          tickFormatter={(d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return ""; } }}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
          tickLine={false} axisLine={false}
          tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(16,16,28,0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
          labelFormatter={(d) => {
            try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); } catch { return String(d); }
          }}
          formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
        />
        <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
