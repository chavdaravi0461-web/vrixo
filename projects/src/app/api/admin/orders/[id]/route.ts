import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { publishEvent } from "@/lib/event-bus";
import { updateOrderStatus, isTransitionAllowed } from "@/lib/orders/order-state-machine";
import { safeRoute } from "@/lib/safe-route";

const allowedStatuses = new Set(["confirmed", "processing", "packed", "shipped", "delivered", "cancelled"]);

export const PATCH = safeRoute(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const body = (await request.json()) as { orderStatus: string };
  const { id } = await params;
  const orderStatus = String(body.orderStatus ?? "").toLowerCase();

  if (!allowedStatuses.has(orderStatus)) {
    return NextResponse.json({ message: "Invalid order status." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, order_status, payment_method, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const result = await updateOrderStatus({
    orderId: id,
    orderNumber: order.order_number,
    toStatus: orderStatus as "confirmed" | "processing" | "packed" | "shipped" | "delivered" | "cancelled",
    changedBy: "admin",
    changedById: guard.admin.user.id,
    reason: `Admin updated from ${order.order_status} to ${orderStatus}`,
    sendWhatsApp: true,
  });

  if (!result.success) {
    return NextResponse.json({ message: result.error || "Failed to update order status." }, { status: 500 });
  }

  await logAdminAudit({
    request,
    adminUserId: guard.admin.user.id,
    adminEmail: guard.admin.user.email,
    action: "order.status_update",
    targetTable: "orders",
    targetId: id,
    metadata: { fromStatus: result.fromStatus, toStatus: orderStatus }
  });

  await publishEvent({
    type: "order.updated",
    severity: orderStatus === "cancelled" ? "warn" : "info",
    entityId: id,
    entityType: "order",
    payload: { orderStatus, adminEmail: guard.admin.user.email }
  });

  return NextResponse.json({ message: "Order updated successfully." });
});
