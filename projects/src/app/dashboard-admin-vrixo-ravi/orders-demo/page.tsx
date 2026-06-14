import React from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMetadata } from "@/lib/metadata";
import "@/styles/omega.css";

export const metadata = buildMetadata("Orders");
export const dynamic = "force-dynamic";

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  total: number | string | null;
  order_status: string | null;
};

export default async function OrdersPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, total, order_status")
    .order("created_at", { ascending: false })
    .limit(12);

  const displayOrders = (orders as Order[] | null) ?? [];

  return (
    <AdminShell>
      <div style={{ padding: "16px", maxWidth: "1200px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "4px" }}>Orders</h1>
          <p style={{ color: "var(--omega-muted)" }}>Manage and track all orders</p>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          {displayOrders.length > 0 ? (
            displayOrders.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard-admin-vrixo-ravi/orders?id=${o.id}`}
                className="omega-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "linear-gradient(180deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))";
                  el.style.borderColor = "rgba(124,58,237,0.2)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "";
                  el.style.borderColor = "";
                }}
              >
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px" }}>{o.order_number}</div>
                  <div style={{ fontSize: "12px", color: "var(--omega-muted)" }}>{o.customer_name || "Guest"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: "700" }}>₹{Number(o.total || 0).toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: "12px", color: "var(--omega-muted)" }}>{o.order_status}</div>
                </div>
              </Link>
            ))
          ) : (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--omega-muted)" }}>No orders found</div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
