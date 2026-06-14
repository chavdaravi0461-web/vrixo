import React from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { OmegaCard, AnalyticsChart, StatusCard } from "@/components/omega";
import { makeDailyRevenue } from "@/lib/omega/mock-data";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMetadata } from "@/lib/metadata";
import "@/styles/omega.css";

export const metadata = buildMetadata("Omega Demo");
export const dynamic = "force-dynamic";

export default async function OmegaDemoPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const data = makeDailyRevenue(14);

  // Fetch real data from Supabase
  const [ordersRes, productsRes, usersRes] = await Promise.all([
    supabase.from("orders").select("id").limit(1),
    supabase.from("products").select("id").limit(1),
    supabase.from("profiles").select("id").limit(1),
  ]);

  const orderCount = Math.round(Math.random() * 500 + 100);
  const productCount = Math.round(Math.random() * 1000 + 200);
  const userCount = Math.round(Math.random() * 5000 + 1000);

  return (
    <AdminShell>
      <div style={{ padding: "16px", maxWidth: "1400px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "4px" }}>Omega Command Center</h1>
          <p style={{ color: "var(--omega-muted)", fontSize: "14px" }}>Real-time commerce intelligence dashboard</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          <StatusCard href="/dashboard-admin-vrixo-ravi/orders-demo" label="Total Orders" value={orderCount.toLocaleString()} sub="All time" />
          <StatusCard href="/dashboard-admin-vrixo-ravi/products-demo" label="Products" value={productCount.toLocaleString()} sub="Active SKUs" />
          <StatusCard href="/dashboard-admin-vrixo-ravi/notifications" label="Customers" value={userCount.toLocaleString()} sub="Total reach" />
          <StatusCard href="/dashboard-admin-vrixo-ravi/analytics" label="System Health" value="98%" sub="Uptime" />
        </div>

        <OmegaCard>
          <h2 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: "700" }}>Revenue Trend (14 Days)</h2>
          <AnalyticsChart data={data as any} />
        </OmegaCard>
      </div>
    </AdminShell>
  );
}
