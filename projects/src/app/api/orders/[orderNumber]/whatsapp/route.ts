import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findOrderForUser, canQueryOrders } from "@/lib/orders/order-repository";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import { hasWhatsAppServerEnv } from "@/lib/whatsapp";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dispatchOrderNotification,
  enqueueOrderConfirmationNotification
} from "@/lib/notification-queue";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export const POST = safeRoute(async function POST(request: Request, context: RouteContext) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "order-whatsapp-retry",
    limit: 6,
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

  if (!hasWhatsAppServerEnv()) {
    return NextResponse.json(
      { message: "WhatsApp is not configured on the server." },
      { status: 503 }
    );
  }

  if (!canQueryOrders()) {
    return NextResponse.json({ message: "Order service unavailable." }, { status: 503 });
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

  const adminSupabase = createAdminClient();
  const notificationId = await enqueueOrderConfirmationNotification(adminSupabase, order.id);
  if (!notificationId) {
    return NextResponse.json(
      { message: "Online payment must be confirmed before WhatsApp confirmation is sent." },
      { status: 409 }
    );
  }
  const result = await dispatchOrderNotification(adminSupabase, notificationId);

  return NextResponse.json({
    sent: result.sent,
    error: result.error,
    adminNotified: result.adminNotified,
    messageId: result.providerMessageId
  });
});
