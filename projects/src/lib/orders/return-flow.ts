import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrderReturnable } from "@/lib/orders/order-state-machine";

export type ReturnRequestCreateInput = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  reason: string;
  details?: string | null;
  items?: Array<{ title: string; quantity: number; price: number }>;
};

export type ReturnRequestResult = {
  success: boolean;
  returnId?: string;
  error?: string;
};

export async function createReturnRequest(input: ReturnRequestCreateInput): Promise<ReturnRequestResult> {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, order_status, user_id, items")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (!isOrderReturnable(String(order.order_status ?? ""))) {
    return { success: false, error: `Order status "${order.order_status}" is not eligible for return` };
  }

  const items = input.items?.length
    ? input.items
    : (order.items as Array<Record<string, unknown>>)?.map((i: Record<string, unknown>) => ({
        title: String(i.title ?? ""),
        quantity: Number(i.quantity ?? 1),
        price: Number(i.price ?? 0),
      })) ?? [];

  const { data: returnId, error } = await supabase.rpc("create_return_request", {
    p_order_id: order.id,
    p_order_number: order.order_number,
    p_user_id: order.user_id,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail ?? null,
    p_reason: input.reason,
    p_details: input.details ?? null,
    p_items: JSON.stringify(items),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, returnId: String(returnId) };
}

export async function processReturnAction(
  returnId: string,
  action: "approve" | "reject" | "schedule_pickup" | "mark_received" | "process_refund" | "complete",
  adminUserId: string,
  extra?: Record<string, unknown>
): Promise<ReturnRequestResult> {
  const supabase = createAdminClient();

  const { data: ret } = await supabase
    .from("return_requests")
    .select("*, orders!inner(order_number, order_status, customer_name, payment_method, total)")
    .eq("id", returnId)
    .maybeSingle();

  if (!ret) {
    return { success: false, error: "Return request not found" };
  }

  const statusMap: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    schedule_pickup: "pickup_scheduled",
    mark_received: "item_received",
    process_refund: "refund_processed",
    complete: "completed",
  };

  const targetStatus = statusMap[action];
  if (!targetStatus) {
    return { success: false, error: `Unknown action: ${action}` };
  }

  const updates: Record<string, unknown> = {
    status: targetStatus,
    resolved_by: adminUserId,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(extra ?? {}),
  };

  if (action === "process_refund") {
    const refundAmount = (extra?.refund_amount as number) ?? Number(ret.total ?? 0);
    updates.refund_amount = refundAmount;
    updates.refund_id = extra?.refund_id ?? null;
  }

  const { error } = await supabase.from("return_requests").update(updates).eq("id", returnId);

  if (error) {
    return { success: false, error: error.message };
  }

  const orderStatusMap: Record<string, string> = {
    approve: "return_approved",
    schedule_pickup: "return_pickup_scheduled",
    mark_received: "return_received",
    process_refund: "refund_processed",
    complete: "completed",
  };

  const newOrderStatus = orderStatusMap[action];
  if (newOrderStatus) {
    const orderId = Array.isArray(ret.orders) ? (ret.orders as Record<string, unknown>[])[0]?.id : (ret as Record<string, unknown>).order_id;
    if (orderId) {
      const orderUpdates: Record<string, unknown> = {
        order_status: newOrderStatus,
        return_status: targetStatus,
        updated_at: new Date().toISOString(),
      };
      if (action === "process_refund") {
        orderUpdates.refund_id = extra?.refund_id ?? null;
        orderUpdates.refund_amount = extra?.refund_amount ?? Number(ret.total ?? 0);
        orderUpdates.refunded_at = new Date().toISOString();
      }
      await supabase.from("orders").update(orderUpdates).eq("id", orderId);
    }
  }

  return { success: true, returnId };
}
