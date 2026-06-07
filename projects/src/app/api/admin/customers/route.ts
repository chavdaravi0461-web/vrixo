import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);
  const search = url.searchParams.get("search")?.trim();
  const sort = url.searchParams.get("sort") ?? "newest";
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select("id, name, email, phone, role, created_at, is_active", { count: "exact" });

  if (search) {
    const safe = search.replace(/[%_,]/g, "");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const { data: profiles, count } = await query.range(from, to);

  const customerIds = (profiles ?? []).map((p) => p.id);

  const orderCounts = customerIds.length > 0
    ? await supabase
        .from("orders")
        .select("user_id, count:user_id")
        .in("user_id", customerIds)
        .then((res) => {
          const map = new Map<string, number>();
          for (const row of (res.data ?? []) as Array<{ user_id: string; count: number }>) {
            map.set(row.user_id, row.count);
          }
          return map;
        })
    : new Map<string, number>();

  const customers = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    role: p.role,
    isActive: p.is_active,
    createdAt: p.created_at,
    orderCount: orderCounts.get(p.id) ?? 0,
  }));

  return NextResponse.json({
    customers,
    pagination: { page, limit, total: count ?? 0 },
  });
});
