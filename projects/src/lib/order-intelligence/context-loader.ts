import { getCustomerFromWhatsApp, type CustomerContext, type CustomerOrderDetailed } from "@/lib/whatsapp/customer-context";
import { getCommerceSession, type CommerceSession } from "@/lib/order-intelligence/commerce-memory";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";

export type SupportHistoryEntry = {
  id: string;
  issue: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export type DeliveryTrackingInfo = {
  orderNumber: string;
  status: string;
  courier: string | null;
  trackingId: string | null;
  estimatedDelivery: string | null;
  lastUpdate: string | null;
};

export type CancelEligibility = {
  orderNumber: string;
  eligible: boolean;
  reason: string | null;
  status: string;
  paymentStatus: string;
};

export type OrderIntelligenceContext = {
  customer: CustomerContext;
  session: CommerceSession;
  cancellableOrders: CancelEligibility[];
  deliveryTracking: DeliveryTrackingInfo[];
  supportHistory: SupportHistoryEntry[];
  productCatalog: Array<{ id: string; title: string; price: number; category: string; image: string | null }>;
  priorityOrder: CustomerOrderDetailed | null;
  knownIssue: string | null;
  canAutoCancel: boolean;
};

const CACHE_TTL = 120;

async function loadSupportHistory(phone: string): Promise<SupportHistoryEntry[]> {
  const supabase = tryCreateAdminClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("contact_messages")
      .select("id, message, admin_reply, created_at, updated_at, status")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(10);
    if (!data || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      issue: String(row.message ?? "").slice(0, 200),
      resolved: String(row.status ?? "") === "resolved",
      createdAt: String(row.created_at ?? ""),
      resolvedAt: String(row.updated_at ?? null),
    }));
  } catch {
    return [];
  }
}

async function loadDeliveryTracking(orders: CustomerOrderDetailed[]): Promise<DeliveryTrackingInfo[]> {
  const shipped = orders.filter((o) => o.orderStatus === "shipped" || o.orderStatus === "delivered");
  if (shipped.length === 0) return [];

  const supabase = tryCreateAdminClient();
  if (!supabase) return [];

  const results: DeliveryTrackingInfo[] = [];
  for (const order of shipped) {
    try {
      const { data } = await supabase
        .from("order_tracking")
        .select("courier, tracking_id, estimated_delivery, last_update")
        .eq("order_number", order.orderNumber)
        .maybeSingle();
      results.push({
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        courier: data?.courier ?? null,
        trackingId: data?.tracking_id ?? null,
        estimatedDelivery: data?.estimated_delivery ?? null,
        lastUpdate: data?.last_update ?? null,
      });
    } catch {
      results.push({ orderNumber: order.orderNumber, status: order.orderStatus, courier: null, trackingId: null, estimatedDelivery: null, lastUpdate: null });
    }
  }
  return results;
}

function computeCancelEligibility(orders: CustomerOrderDetailed[]): CancelEligibility[] {
  return orders
    .filter((o) => o.orderStatus !== "cancelled")
    .map((o) => {
      const eligible = o.orderStatus === "pending" || o.orderStatus === "confirmed";
      return {
        orderNumber: o.orderNumber,
        eligible,
        reason: eligible ? null : `Order is ${o.orderStatus} — cancellation only available for pending or confirmed orders`,
        status: o.orderStatus,
        paymentStatus: o.paymentStatus,
      };
    });
}

async function loadProductCatalog(limit = 20): Promise<Array<{ id: string; title: string; price: number; category: string; image: string | null }>> {
  const cacheKey = "catalog:lightweight";
  const cached = await withRedis(async (r) => {
    const val = await r.get(cacheKey);
    return val ? (JSON.parse(val) as Array<{ id: string; title: string; price: number; category: string; image: string | null }>) : null;
  }, null);
  if (cached) return cached;

  const supabase = tryCreateAdminClient();
  if (!supabase) return [];

  try {
    const { data } = await supabase
      .from("products")
      .select("id, title, price, category, image")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!data || !Array.isArray(data)) return [];
    const mapped = data.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      price: Number(row.price ?? 0),
      category: String(row.category ?? ""),
      image: row.image ? String(row.image) : null,
    }));
    await withRedis(async (r) => { await r.setex(cacheKey, 300, JSON.stringify(mapped)); return true; }, false);
    return mapped;
  } catch {
    return [];
  }
}

export async function loadOrderIntelligenceContext(phone: string): Promise<OrderIntelligenceContext | null> {
  const customer = await getCustomerFromWhatsApp(phone);
  if (!customer) return null;

  const session = await getCommerceSession(phone);
  const cancellableOrders = computeCancelEligibility(customer.orders);
  const deliveryTracking = await loadDeliveryTracking(customer.orders);
  const supportHistory = await loadSupportHistory(customer.phone ?? phone);
  const productCatalog = await loadProductCatalog();

  const priorityOrder = customer.pendingPayments.length > 0
    ? customer.pendingPayments[0]
    : customer.activeOrders.length > 0
      ? customer.activeOrders[0]
      : null;

  const unresolvedEntry = session.unresolvedIssues[0] ?? null;
  const knownIssue = unresolvedEntry
    ? unresolvedEntry
    : supportHistory.length > 0 && !supportHistory[0].resolved
      ? supportHistory[0].issue
      : null;

  const canAutoCancel = cancellableOrders.some((c) => c.eligible);

  return {
    customer,
    session,
    cancellableOrders,
    deliveryTracking,
    supportHistory,
    productCatalog,
    priorityOrder,
    knownIssue,
    canAutoCancel,
  };
}

export function buildContextSummary(ctx: OrderIntelligenceContext): string {
  const parts: string[] = [];

  if (ctx.customer.name) parts.push(`Name: ${ctx.customer.name}`);
  parts.push(`Orders: ${ctx.customer.orderCount} (${ctx.customer.activeOrders.length} active, ${ctx.customer.cancelledOrders.length} cancelled)`);

  if (ctx.customer.hasPendingPayments) {
    parts.push(`Pending payments: ${ctx.customer.pendingPayments.map((o) => `#${o.orderNumber} (Rs.${o.total})`).join(", ")}`);
  }

  if (ctx.customer.cartItemCount > 0) {
    parts.push(`Active cart: ${ctx.customer.cartItemCount} items (Rs.${ctx.customer.cartTotal})`);
  }

  if (ctx.cancellableOrders.some((c) => c.eligible)) {
    const eligible = ctx.cancellableOrders.filter((c) => c.eligible);
    parts.push(`Cancellable orders: ${eligible.map((c) => `#${c.orderNumber}`).join(", ")}`);
  }

  if (ctx.deliveryTracking.length > 0) {
    for (const t of ctx.deliveryTracking) {
      const eta = t.estimatedDelivery ? ` ETA: ${t.estimatedDelivery}` : "";
      parts.push(`#${t.orderNumber}: ${t.status}${eta}`);
    }
  }

  if (ctx.knownIssue) {
    parts.push(`Known issue: ${ctx.knownIssue}`);
  }

  if (ctx.customer.customerSegment) {
    parts.push(`Segment: ${ctx.customer.customerSegment}`);
  }

  if (ctx.session.escalatedBefore) {
    parts.push("Previously escalated - fast-track");
  }

  if (ctx.session.previousOrdersDiscussed.length > 0) {
    parts.push(`Previously discussed: ${ctx.session.previousOrdersDiscussed.join(", ")}`);
  }

  return parts.join("\n");
}
