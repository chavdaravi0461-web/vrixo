import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import { canQueryOrders } from "@/lib/orders/order-repository";
import { updateOrderStatus } from "@/lib/orders/order-state-machine";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export const POST = safeRoute(async function POST(request: Request, context: RouteContext) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "order-cancel",
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const { orderNumber: rawOrderNumber } = await context.params;
  const orderNumber = decodeOrderNumberParam(rawOrderNumber);
  if (!isValidOrderNumber(orderNumber) || !canQueryOrders()) {
    return NextResponse.json({ message: "Invalid order number." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Please login to cancel your order." }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: order } = await adminSupabase
    .from("orders")
    .select("id, order_number, order_status, user_id, total, items, payment_method, payment_status, customer_name")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const result = await updateOrderStatus({
    orderId: order.id,
    orderNumber: order.order_number,
    toStatus: "cancelled",
    changedBy: "customer",
    changedById: user.id,
    reason: "Customer requested via website",
    extraUpdates: {
      payment_status: order.payment_method === "cod" ? "cod_pending" : "refunded",
      cancellation_reason: "Customer requested via website",
    },
    sendWhatsApp: true,
  });

  if (!result.success) {
    return NextResponse.json({ message: result.error || "Failed to cancel order." }, { status: 500 });
  }

  const firstItem = Array.isArray(order.items) ? (order.items[0] as Record<string, unknown>) : null;
  const itemTitle = firstItem ? String(firstItem.title ?? "") : "Order";
  const total = Number(order.total ?? 0);

  try {
    const { sendWhatsAppTextMessage, formatWhatsAppPhone, getWhatsAppServerEnv } = await import("@/lib/whatsapp");
    const { data: customerOrder } = await adminSupabase
      .from("orders")
      .select("customer_phone")
      .eq("id", order.id)
      .maybeSingle();
    if (customerOrder?.customer_phone) {
      const env = getWhatsAppServerEnv();
      const phone = formatWhatsAppPhone(customerOrder.customer_phone as string);
      if (phone && env.WHATSAPP_CLOUD_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
        const refundNote = order.payment_method === "cod"
          ? "No charges were made as this was a Cash on Delivery order."
          : `Your refund of ₹${Math.round(total)} will be processed within 3-5 business days.`;
        const text = [
          `✅ Order Cancelled`,
          ``,
          `Your order ${orderNumber} has been cancelled successfully.`,
          ``,
          `🛍 ${itemTitle}`,
          `💰 ₹${Math.round(total)}`,
          ``,
          refundNote,
          ``,
          `Track your cancelled order: https://vrixo.in/order/track/${orderNumber}`,
        ].join("\n");
        sendWhatsAppTextMessage({
          to: phone, text, token: env.WHATSAPP_CLOUD_API_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        }).catch(() => {});
      }
    }
  } catch {}

  return NextResponse.json({ message: "Order cancelled successfully." });
});
