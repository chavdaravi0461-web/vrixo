import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  try {
    const [{ count: totalOrders }, { data: orderRows }, { data: itemRows }] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("total"),
      supabase.from("order_items").select("product_id, title, quantity")
    ]);

    const revenue = (orderRows ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const topProducts = Array.from(
      (itemRows ?? []).reduce((map, row) => {
        const productId = String(row.product_id ?? "");
        if (!productId) return map;
        const existing = map.get(productId) ?? { product_id: productId, title: String(row.title ?? ""), total_qty: 0 };
        existing.total_qty += Number(row.quantity ?? 0);
        map.set(productId, existing);
        return map;
      }, new Map<string, { product_id: string; title: string; total_qty: number }>())
    )
      .map(([, row]) => row)
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 10);

    return NextResponse.json({ totalOrders: totalOrders ?? 0, revenue, topProducts });
  } catch (err) {
    console.error("[analytics.summary]", err);
    return NextResponse.json({ message: "Analytics temporarily unavailable." }, { status: 500 });
  }
}
