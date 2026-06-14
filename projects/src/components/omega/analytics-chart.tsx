"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function AnalyticsChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  const [series, setSeries] = useState("revenue");
  const formatted = useMemo(() => data.map((d) => ({ ...d })), [data]);

  return (
    <div style={{ width: "100%", height: 260 }} className="omega-analytics-card">
      <div className="omega-analytics-controls">
        <button className={`omega-ctrl ${series === "revenue" ? "active" : ""}`} onClick={() => setSeries("revenue")}>
          Revenue
        </button>
        <button className={`omega-ctrl ${series === "orders" ? "active" : ""}`} onClick={() => setSeries("orders")}>
          Orders
        </button>
      </div>
      <ResponsiveContainer>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={series === "revenue" ? "revenue" : "orders"} stroke="#82ca9d" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsChart;
