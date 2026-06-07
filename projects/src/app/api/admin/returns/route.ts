import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("return_requests")
    .select("id, order_number, customer_name, customer_phone, reason, status, refund_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ returns: data ?? [] });
});
