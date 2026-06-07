import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_LIFECYCLE, type OrderState } from "@/types";

export class InvalidOrderTransition extends Error {
  constructor(orderNumber: string, from: string, to: string) {
    super(`Order ${orderNumber}: transition from "${from}" to "${to}" is not allowed`);
    this.name = "InvalidOrderTransition";
  }
}

export class OrderNotFound extends Error {
  constructor(orderNumber: string) {
    super(`Order ${orderNumber} not found`);
    this.name = "OrderNotFound";
  }
}

export function isTransitionAllowed(
  currentStatus: string,
  targetStatus: OrderState
): boolean {
  const state = currentStatus.toLowerCase() as OrderState;
  const lifecycle = ORDER_LIFECYCLE[state];
  if (!lifecycle) return false;
  return lifecycle.allowedTransitions.includes(targetStatus);
}

export function getCancellableStatuses(): string[] {
  return Object.entries(ORDER_LIFECYCLE)
    .filter(([_, def]) => def.cancellable)
    .map(([status]) => status);
}

export function getReturnableStatuses(): string[] {
  return Object.entries(ORDER_LIFECYCLE)
    .filter(([_, def]) => def.returnable)
    .map(([status]) => status);
}

export function isOrderCancellable(status: string): boolean {
  return getCancellableStatuses().includes(status.toLowerCase());
}

export function isOrderReturnable(status: string): boolean {
  return getReturnableStatuses().includes(status.toLowerCase());
}

export function getOrderLabel(status: string): string {
  const state = status.toLowerCase() as OrderState;
  return ORDER_LIFECYCLE[state]?.label ?? status;
}

type UpdateOrderStatusInput = {
  orderId: string;
  orderNumber: string;
  toStatus: OrderState;
  changedBy: string;
  changedById?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  extraUpdates?: Record<string, unknown>;
  sendWhatsApp?: boolean;
};

type UpdateOrderStatusResult = {
  success: boolean;
  fromStatus: string;
  toStatus: string;
  error?: string;
  logId?: string;
};

export async function updateOrderStatus(
  input: UpdateOrderStatusInput
): Promise<UpdateOrderStatusResult> {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, order_status, customer_name, customer_phone, payment_method, payment_status, total, items")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) {
    return { success: false, fromStatus: "", toStatus: input.toStatus, error: "Order not found" };
  }

  const currentStatus = String(order.order_status ?? "").toLowerCase();
  const targetStatus = input.toStatus;

  if (currentStatus === targetStatus) {
    return { success: true, fromStatus: currentStatus, toStatus: targetStatus, error: undefined };
  }

  if (!isTransitionAllowed(currentStatus, targetStatus)) {
    return {
      success: false,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      error: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
    };
  }

  const timestampFields: Record<string, string> = {};
  if (targetStatus === "shipped") timestampFields.shipped_at = new Date().toISOString();
  if (targetStatus === "delivered") timestampFields.delivered_at = new Date().toISOString();
  if (targetStatus === "cancelled") timestampFields.cancelled_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      order_status: targetStatus,
      updated_at: new Date().toISOString(),
      ...timestampFields,
      ...(input.extraUpdates ?? {}),
    })
    .eq("id", input.orderId);

  if (updateError) {
    return { success: false, fromStatus: currentStatus, toStatus: targetStatus, error: updateError.message };
  }

  const { data: logData, error: logError } = await supabase.rpc("log_order_status", {
    p_order_id: input.orderId,
    p_from_status: currentStatus,
    p_to_status: targetStatus,
    p_changed_by: input.changedBy,
    p_changed_by_id: input.changedById ?? null,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (logError) {
    console.error("[order-state-machine] audit log failed", logError);
  }

  if (input.sendWhatsApp) {
    try {
      const { sendOrderStatusWhatsApp } = await import("@/lib/whatsapp/order-events");
      await sendOrderStatusWhatsApp({
        customerName: String(order.customer_name ?? ""),
        customerPhone: String(order.customer_phone ?? ""),
        orderNumber: input.orderNumber,
        orderStatus: targetStatus,
        paymentMethod: String(order.payment_method ?? "cod") as "cod" | "online",
        paymentStatus: String(order.payment_status ?? ""),
        totalAmount: Number(order.total ?? 0),
        items: order.items as Array<Record<string, unknown>>,
      }).catch(() => {});
    } catch {}
  }

  return {
    success: true,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    logId: logData ? String(logData) : undefined,
  };
}
