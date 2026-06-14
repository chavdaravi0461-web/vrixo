import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingNotifications } from "@/lib/notification-queue";
import { logInfo, logError } from "@/lib/observability";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-key");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100);

  logInfo("cron.notification_retry.start", { limit });

  try {
    const results = await processPendingNotifications(supabase, limit);
    const sent = results.filter((r) => r.result.sent).length;
    const failed = results.filter((r) => !r.result.sent).length;
    logInfo("cron.notification_retry.complete", { total: results.length, sent, failed });
    return NextResponse.json({ processed: results.length, sent, failed });
  } catch (error) {
    logError("cron.notification_retry.failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { message: "Retry processing failed", error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
