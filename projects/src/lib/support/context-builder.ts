import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import type { SupportContext, SupportOrder } from "./types";

const ORDER_FIELDS = `
  order_number, order_status, payment_status, payment_method,
  total, created_at, customer_name, customer_phone,
  shipping_address, items, tracking_number
`;

function normalizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (["pending", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled"].includes(s)) return s;
  return "pending";
}

function isCancellable(status: string): boolean {
  return ["pending", "confirmed"].includes(normalizeStatus(status));
}

function isReturnable(status: string): boolean {
  return normalizeStatus(status) === "delivered";
}

function buildOrder(raw: Record<string, unknown>): SupportOrder {
  const status = normalizeStatus(String(raw.order_status ?? ""));
  const items: SupportOrder["items"] = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map((i) => ({
        title: String(i.title ?? i.productTitle ?? "Product"),
        quantity: Number(i.quantity ?? 1),
        price: Number(i.price ?? 0),
      }))
    : [];
  const addr = raw.shipping_address as Record<string, unknown> | null;
  return {
    orderNumber: String(raw.order_number ?? ""),
    orderStatus: status,
    paymentStatus: String(raw.payment_status ?? "").toLowerCase(),
    paymentMethod: String(raw.payment_method ?? "").toLowerCase(),
    total: Number(raw.total ?? 0),
    createdAt: String(raw.created_at ?? ""),
    customerName: String(raw.customer_name ?? ""),
    customerPhone: String(raw.customer_phone ?? ""),
    shippingAddress: addr,
    items,
    isCancellable: isCancellable(String(raw.order_status ?? "")),
    isReturnable: isReturnable(String(raw.order_status ?? "")),
    trackingNumber: (raw.tracking_number as string | null) ?? null,
    courier: (addr?.courier as string | null) ?? null,
    estimatedDelivery: (addr?.estimatedDelivery as string | null) ?? null,
  };
}

export async function buildSupportContext(params: {
  userId?: string | null;
  phone?: string | null;
}): Promise<SupportContext | null> {
  const supabase = createAdminClient();

  let profile: Record<string, unknown> | null = null;
  let orders: Record<string, unknown>[] = [];
  let phone = params.phone ? sanitizeCustomerPhone(params.phone) : null;

  try {
    if (params.userId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("id", params.userId)
        .maybeSingle();
      profile = p as Record<string, unknown> | null;
      if (!phone && profile?.phone) {
        phone = sanitizeCustomerPhone(String(profile.phone));
      }
    }
  } catch {
    /* profile unavailable */
  }

  try {
    if (params.userId) {
      const { data: o } = await supabase
        .from("orders")
        .select(ORDER_FIELDS)
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (o) orders = o as Record<string, unknown>[];
    }

    if (orders.length === 0 && phone) {
      const { data: o } = await supabase
        .from("orders")
        .select(ORDER_FIELDS)
        .eq("customer_phone", phone)
        .order("created_at", { ascending: false })
        .limit(25);
      if (o) orders = o as Record<string, unknown>[];
    }
  } catch {
    /* orders unavailable */
  }

  const detailed = orders.map(buildOrder);
  const activeOrders = detailed.filter((o) => o.orderStatus !== "cancelled");
  const cancelledOrders = detailed.filter((o) => o.orderStatus === "cancelled");
  const refundedOrders = detailed.filter(
    (o) => o.orderStatus === "cancelled" && o.paymentStatus === "refunded",
  );

  const ctx: SupportContext = {
    customer: {
      name: profile?.name as string | null ?? detailed[0]?.customerName ?? null,
      email: profile?.email as string | null ?? null,
      phone: profile?.phone as string | null ?? phone,
      userId: params.userId ?? null,
      isLoggedIn: Boolean(params.userId),
    },
    orders: detailed,
    activeOrders,
    cancelledOrders,
    refundedOrders,
    hasActiveOrders: activeOrders.length > 0,
    orderCount: detailed.length,
    cart: { itemCount: 0, total: 0, items: [] },
  };

  return ctx;
}
