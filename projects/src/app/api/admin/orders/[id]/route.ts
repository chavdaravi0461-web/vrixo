import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { publishEvent } from "@/lib/event-bus";

const allowedStatuses = new Set(["processing", "shipped", "delivered", "cancelled"]);

export async function PATCH(
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
  const { error } = await supabase
    .from("orders")
    .update({ order_status: orderStatus })
    .eq("id", id);

  if (error) {
    return serverError();
  }

  await logAdminAudit({
    request,
    adminUserId: guard.admin.user.id,
    adminEmail: guard.admin.user.email,
    action: "order.status_update",
    targetTable: "orders",
    targetId: id,
    metadata: { orderStatus }
  });

  await publishEvent({
    type: "order.updated",
    severity: orderStatus === "cancelled" ? "warn" : "info",
    entityId: id,
    entityType: "order",
    payload: { orderStatus, adminEmail: guard.admin.user.email }
  });

  return NextResponse.json({ message: "Order updated successfully." });
}
