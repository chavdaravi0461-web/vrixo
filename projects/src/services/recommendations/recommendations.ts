import { createAdminClient } from "@/lib/supabase/admin";

export async function recommendForUser(userId: string, limit = 8) {
  const supabase = createAdminClient();
  // 1. Recent purchases by user -> recommend similar
  const { data: recentOrders } = await supabase.from("orders").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const orderIds = (recentOrders ?? []).map((o: { id: string }) => o.id);

  // 2. Top products overall fallback
  const query = supabase.from("order_items").select("product_id, title, quantity");
  const { data: rows } = orderIds.length > 0
    ? await query.in("order_id", orderIds)
    : await query.limit(500);

  return aggregateTopProducts(rows ?? [], limit).map((r) => ({ productId: r.product_id, title: r.title }));
}

export async function recommendSimilar(productId: string, limit = 8) {
  const supabase = createAdminClient();
  // find orders containing productId
  const { data: rows } = await supabase.from("order_items").select("order_id").eq("product_id", productId).limit(500);
  const orderIds = (rows ?? []).map((r: { order_id: string }) => r.order_id);

  if (orderIds.length === 0) return [];

  const { data: co } = await supabase
    .from("order_items")
    .select("product_id, title, quantity")
    .in("order_id", orderIds)
    .neq("product_id", productId)
    .limit(500);

  return aggregateTopProducts(co ?? [], limit).map((r) => ({ productId: r.product_id, title: r.title }));
}

function aggregateTopProducts(
  rows: Array<{ product_id: string | null; title: string | null; quantity: number | null }>,
  limit: number
) {
  return Array.from(
    rows.reduce((map, row) => {
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
    .slice(0, limit);
}
