import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findOrderForUser, canQueryOrders } from "@/lib/orders/order-repository";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import { getAppUrl } from "@/lib/app-url";
import { hasWhatsAppServerEnv } from "@/lib/whatsapp";
import { dispatchOrderConfirmationWhatsApp } from "@/services/notifications/order-whatsapp";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";

type RouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const items = normalizeItems(order.items);
  const firstItem = items[0] ?? {};
  const appUrl = getAppUrl();
  const paymentMethod = resolvePaymentMethod(order.payment_method);

  const result = await dispatchOrderConfirmationWhatsApp(
    {
      orderId: order.id,
      userId: user.id,
      customerName: String(order.customer_name ?? "Customer"),
      customerPhone: String(order.customer_phone ?? ""),
      orderNumber: order.order_number,
      productNames: items.map((item) => item.title).join(", ") || "Vrixo product",
      totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: Number(order.total ?? 0),
      orderStatus: String(order.order_status ?? "pending"),
      paymentMethod,
      paymentStatus: String(order.payment_status ?? ""),
      productImageUrl: resolveAbsoluteImage(String(firstItem.image ?? ""), appUrl),
      deliveryAddress: formatAddress(order.shipping_address)
    },
    { force: true }
  );

  return NextResponse.json({
    sent: result.sent,
    error: result.error,
    adminNotified: result.adminNotified,
    skipped: result.skipped ?? false
  });
}

function resolvePaymentMethod(value: unknown): "cod" | "online" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "cod" || normalized.includes("cash")) return "cod";
  return "online";
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ title: string; quantity: number; image: string }>;

  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      title: String(record.title ?? "Vrixo product"),
      quantity: Number(record.quantity ?? 1),
      image: record.image ? String(record.image) : ""
    };
  });
}

function resolveAbsoluteImage(value: string, baseUrl: string) {
  if (!value) return `${baseUrl}/placeholder-product.svg`;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return `${baseUrl}/placeholder-product.svg`;
  }
}

function formatAddress(value: unknown) {
  if (!value || typeof value !== "object") return "Delivery address saved with your order";
  const address = value as Record<string, unknown>;
  return (
    [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
      .map((part) => (part ? String(part).trim() : ""))
      .filter(Boolean)
      .join(", ") || "Delivery address saved with your order"
  );
}
