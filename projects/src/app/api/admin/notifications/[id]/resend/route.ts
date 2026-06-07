import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchOrderNotification } from "@/lib/notification-queue";
import { logAdminAudit } from "@/lib/admin-audit";
import { safeRoute } from "@/lib/safe-route";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = safeRoute(async function POST(_request: Request, context: RouteContext) {
  await requireAdmin();
  const { id } = await context.params;

  const supabase = createAdminClient();

  const { data: notification } = await supabase
    .from("order_notifications")
    .select("id, status, payload")
    .eq("id", id)
    .maybeSingle();

  if (!notification) {
    return NextResponse.json({ message: "Notification not found." }, { status: 404 });
  }

  const result = await dispatchOrderNotification(supabase, id);

  void logAdminAudit({
    action: "resend_notification",
    targetTable: "order_notifications",
    targetId: id,
    metadata: { result },
  });

  return NextResponse.json({
    message: result.sent ? "Notification sent successfully." : `Failed: ${result.error}`,
    result,
  });
});
