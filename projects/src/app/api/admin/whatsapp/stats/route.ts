import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";
import { safeRoute } from "@/lib/safe-route";
import { getWhatsAppRecentLogs, getWhatsAppFailedLogs } from "@/services/notifications/whatsapp-log-store";

export const GET = safeRoute(async function GET(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const supabase = createAdminClient();

  const [sentResult, failedResult, pendingResult, recentLogs, failedLogs] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_status", "sent"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_status", "failed"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_status", "pending"),
    getWhatsAppRecentLogs(20),
    getWhatsAppFailedLogs(10)
  ]);

  const recentMessages = (recentLogs ?? []).slice(0, 10).map((log: Record<string, unknown>) => ({
    id: String(log.id ?? ""),
    orderNumber: String(log.orderNumber ?? ""),
    status: String(log.status ?? "unknown"),
    error: log.error ? String(log.error) : null,
    sentAt: String(log.sentAt ?? log.createdAt ?? new Date().toISOString()),
    phoneSuffix: String(log.phoneSuffix ?? "****")
  }));

  const lastFailed = failedLogs?.[0] as Record<string, unknown> | undefined;

  const totalSent = sentResult.count ?? 0;
  const totalFailed = failedResult.count ?? 0;
  const totalPending = pendingResult.count ?? 0;
  const totalAttempted = totalSent + totalFailed;

  return NextResponse.json({
    totalSent,
    totalFailed,
    totalPending,
    deliveryRate: totalAttempted > 0 ? totalSent / totalAttempted : 1,
    apiStatus: totalFailed > totalSent ? "degraded" : totalFailed > 0 ? "degraded" : "ok",
    lastSuccessAt: null,
    lastFailedAt: lastFailed ? String(lastFailed.createdAt ?? "") : null,
    lastErrorMessage: lastFailed ? String(lastFailed.error ?? "") : null,
    recentMessages
  });
});
