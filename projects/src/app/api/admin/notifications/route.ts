import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppFailedLogs, getWhatsAppRecentLogs } from "@/services/notifications/whatsapp-log-store";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "recent";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  const supabase = createAdminClient();

  const [failedRedis, recentRedis, dbPending, dbFailed] = await Promise.all([
    type === "failed" ? getWhatsAppFailedLogs(limit) : Promise.resolve([] as import("@/services/notifications/whatsapp-log-store").WhatsAppRedisLog[]),
    type === "recent" ? getWhatsAppRecentLogs(limit) : Promise.resolve([] as import("@/services/notifications/whatsapp-log-store").WhatsAppRedisLog[]),
    supabase
      .from("order_notifications")
      .select("id, order_id, status, attempts, max_attempts, last_error, next_retry_at, created_at, updated_at, payload")
      .in("status", ["pending", "retry_scheduled", "processing"])
      .limit(limit)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_notifications")
      .select("id, order_id, status, attempts, max_attempts, last_error, created_at, updated_at, payload")
      .eq("status", "failed")
      .limit(limit)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    redis: { failed: failedRedis, recent: recentRedis },
    db: {
      pending: dbPending.data ?? [],
      failed: dbFailed.data ?? [],
    },
  });
});
