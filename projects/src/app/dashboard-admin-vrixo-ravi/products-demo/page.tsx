import React from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMetadata } from "@/lib/metadata";
import "@/styles/omega.css";

export const metadata = buildMetadata("Products");
export const dynamic = "force-dynamic";

type Product = {
  id: string;
  title: string;
  price: number | string | null;
  stock: number | null;
};

export default async function ProductsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, title, price, stock")
    .order("created_at", { ascending: false })
    .limit(12);

  const displayProducts = (products as Product[] | null) ?? [];

  return (
    <AdminShell>
      <div style={{ padding: "16px", maxWidth: "1200px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "4px" }}>Products</h1>
          <p style={{ color: "var(--omega-muted)" }}>Manage inventory and product catalog</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
          {displayProducts.length > 0 ? (
            displayProducts.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard-admin-vrixo-ravi/products?sku=${p.id}`}
                className="omega-card"
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "linear-gradient(180deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))";
                  el.style.borderColor = "rgba(124,58,237,0.2)";
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "";
                  el.style.borderColor = "";
                  el.style.transform = "";
                }}
              >
                <div style={{ fontWeight: "700", fontSize: "14px" }}>{p.title}</div>
                <div style={{ fontSize: "12px", color: "var(--omega-muted)" }}>
                  ₹{Number(p.price || 0).toLocaleString("en-IN")} · {p.stock ?? 0} in stock
                </div>
              </Link>
            ))
          ) : (
            <div style={{ gridColumn: "1/-1", padding: "24px", textAlign: "center", color: "var(--omega-muted)" }}>No products found</div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
