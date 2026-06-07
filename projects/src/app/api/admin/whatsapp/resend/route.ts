import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";
import { safeRoute } from "@/lib/safe-route";
import {
  dispatchOrderNotification,
  enqueueOrderConfirmationNotification
} from "@/lib/notification-queue";

export const POST = safeRoute(async function POST(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-admin-key", "x-server-key"], [
    process.env.ADMIN_API_KEY,
    process.env.WHATSAPP_ADMIN_SECRET
  ]);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "");

  if (!orderId) {
    return NextResponse.json({ message: "orderId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, whatsapp_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ message: "order not found" }, { status: 404 });
  if (order.whatsapp_status === "sent" || order.whatsapp_status === "delivered" || order.whatsapp_status === "read") {
    return NextResponse.json(
      { message: "WhatsApp confirmation was already sent. Duplicate resend blocked." },
      { status: 409 }
    );
  }

  const notificationId = await enqueueOrderConfirmationNotification(supabase, order.id);
  if (!notificationId) {
    return NextResponse.json({ message: "Order is not eligible for confirmation." }, { status: 409 });
  }

  await supabase
    .from("order_notifications")
    .update({
      status: "pending",
      next_retry_at: new Date().toISOString(),
      lease_expires_at: null,
      locked_by: null,
      last_error: null,
      attempts: 0
    })
    .eq("id", notificationId)
    .in("status", ["failed", "retry_scheduled", "pending"]);

  const result = await dispatchOrderNotification(supabase, notificationId);
  return NextResponse.json({
    ok: result.sent,
    message: result.sent ? "WhatsApp confirmation sent." : "WhatsApp retry scheduled.",
    error: result.error,
    messageId: result.providerMessageId
  });
});
