import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();

  const supabase = createAdminClient();

  let query = supabase
    .from("profiles")
    .select("id, name, email, phone, created_at")
    .not("email", "is", null)
    .neq("email", "")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search) {
    const safe = search.replace(/[%_,]/g, "");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data: profiles } = await query;

  return NextResponse.json({
    customers: (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      createdAt: p.created_at,
    })),
  });
});
