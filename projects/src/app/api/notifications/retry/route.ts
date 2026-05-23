import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalServerEnv } from "@/lib/env/server";
import { processPendingNotifications } from "@/lib/notification-queue";
import { securityLog } from "@/lib/security";

export async function GET(request: Request) {
  const env = getOptionalServerEnv();
  const secretHeader = request.headers.get("x-notification-worker-secret");
  const requestUrl = new URL(request.url);
  const secretQuery = requestUrl.searchParams.get("secret");
  const secret = secretHeader || secretQuery || "";

  if (!env.NOTIFICATION_WORKER_SECRET || secret !== env.NOTIFICATION_WORKER_SECRET) {
    securityLog("notifications.retry.unauthorized", {
      path: requestUrl.pathname,
      source: request.headers.get("x-forwarded-for") ?? request.headers.get("host")
    });

    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(requestUrl.searchParams.get("limit") ?? "25");
  const adminSupabase = createAdminClient();

  try {
    const results = await processPendingNotifications(adminSupabase, Math.min(Math.max(limit, 1), 100));
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    securityLog("notifications.retry.failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { message: "Notification retry processing failed.", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
