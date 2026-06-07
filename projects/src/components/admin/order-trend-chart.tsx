"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DataPoint = { created_at: string; total: number };

function aggregate(data: DataPoint[]): { date: string; orders: number }[] {
  if (!data?.length) return [];
  const map = new Map<string, number>();
  for (const d of data) {
    const day = d.created_at?.slice(0, 10);
    if (day) map.set(day, (map.get(day) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([date, orders]) => ({ date, orders }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function OrderTrendChart({ data }: { data: DataPoint[] }) {
  const chartData = aggregate(data);
  if (!chartData.length) {
    return <div className="flex h-[180px] items-center justify-center text-xs text-[var(--ai-text-muted)]">No order data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
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
          allowDecimals={false}
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
          formatter={(value) => [Number(value), "Orders"]}
        />
        <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={22} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}
