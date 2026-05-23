import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findOrderForUser, canQueryOrders } from "@/lib/orders/order-repository";
import { buildOrderStatusView } from "@/lib/orders/order-status";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "order-lookup",
    limit: 40,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return tooManyRequests(rateLimit.retryAfter);
  }

  const { orderNumber: rawOrderNumber } = await context.params;
  const orderNumber = decodeOrderNumberParam(rawOrderNumber);

  if (!isValidOrderNumber(orderNumber)) {
    return NextResponse.json({ message: "Invalid order number." }, { status: 400 });
  }

  if (!canQueryOrders()) {
    return NextResponse.json(
      { message: "Order lookup is temporarily unavailable." },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Login required." }, { status: 401 });
  }

  const order = await findOrderForUser(orderNumber, user.id);

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const statusView = buildOrderStatusView({
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status
  });

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total ?? 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      razorpayPaymentId: order.razorpay_payment_id,
      createdAt: order.created_at,
      customerPhone: order.customer_phone,
      customerName: order.customer_name,
      shippingAddress: order.shipping_address,
      items: order.items,
      whatsappStatus: order.whatsapp_status,
      whatsappError: order.whatsapp_error,
      statusView
    }
  });
}
