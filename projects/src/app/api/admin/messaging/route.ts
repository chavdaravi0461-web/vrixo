import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createAdminClient();

  const { data: messages, count } = await supabase
    .from("customer_messages")
    .select("id, subject, recipient_count, sent_count, failed_count, sent_by, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  return NextResponse.json({
    messages: messages ?? [],
    pagination: { page, limit, total: count ?? 0 },
  });
});
