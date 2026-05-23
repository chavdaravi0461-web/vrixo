import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import { cacheSetJson } from "@/lib/redis";
import { recordBrowsingSession, recordPurchase } from "@/services/ai/customer-memory";

export type BehaviorEventInput = {
  userId?: string | null;
  sessionId: string;
  eventType: "page_view" | "product_view" | "add_to_cart" | "checkout_start" | "payment_start" | "purchase" | "search" | "support_open";
  path?: string;
  productId?: string;
  category?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

export type CustomerIntelligence = {
  conversionProbability: number;
  lifetimeValue: number;
  churnRisk: number;
  vip: boolean;
  intent: "research" | "purchase" | "support" | "high_intent" | "unknown";
};

export async function trackBehaviorEvent(input: BehaviorEventInput) {
  const occurredAt = new Date().toISOString();
  const supabase = createAdminClient();

  await supabase.from("customer_behavior_events").insert({
    user_id: input.userId ?? null,
    session_id: input.sessionId,
    event_type: input.eventType,
    path: input.path ?? null,
    product_id: input.productId ?? null,
    category: input.category ?? null,
    value: input.value ?? null,
    metadata: input.metadata ?? {},
    occurred_at: occurredAt
  });

  if (input.userId && input.category) {
    await recordBrowsingSession(input.userId, [input.category], Number(input.metadata?.duration ?? 0));
  }

  await publishEvent({
    type: "customer.activity",
    severity: input.eventType === "checkout_start" || input.eventType === "payment_start" ? "warn" : "info",
    customerId: input.userId ?? null,
    entityId: input.productId ?? input.sessionId,
    entityType: input.productId ? "product" : "session",
    payload: input as unknown as Record<string, unknown>
  });

  await cacheSetJson(`behavior:session:${input.sessionId}:last`, { ...input, occurredAt }, 60 * 60 * 24);
}

export async function buildCustomerIntelligence(userId: string): Promise<CustomerIntelligence> {
  const supabase = createAdminClient();
  const [{ data: events }, { data: orders }] = await Promise.all([
    supabase
      .from("customer_behavior_events")
      .select("event_type, value, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("orders")
      .select("total, order_status, payment_status, created_at, items")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const recentEvents = events ?? [];
  const completedOrders = (orders ?? []).filter((order) => String(order.order_status).toLowerCase() !== "cancelled");
  const revenue = completedOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const checkoutSignals = recentEvents.filter((event) => ["checkout_start", "payment_start", "add_to_cart"].includes(String(event.event_type))).length;
  const productViews = recentEvents.filter((event) => event.event_type === "product_view").length;
  const conversionProbability = Math.min(0.98, (checkoutSignals * 0.22) + (productViews * 0.025) + (completedOrders.length > 0 ? 0.18 : 0));
  const lastOrderAt = completedOrders[0]?.created_at ? new Date(completedOrders[0].created_at).getTime() : 0;
  const daysSinceOrder = lastOrderAt ? (Date.now() - lastOrderAt) / (1000 * 60 * 60 * 24) : 999;
  const churnRisk = Math.min(0.99, daysSinceOrder > 120 ? 0.86 : daysSinceOrder > 60 ? 0.54 : daysSinceOrder > 30 ? 0.31 : 0.12);
  const intent = checkoutSignals >= 2 ? "high_intent" : checkoutSignals === 1 ? "purchase" : recentEvents.some((event) => event.event_type === "support_open") ? "support" : productViews > 2 ? "research" : "unknown";

  return {
    conversionProbability,
    lifetimeValue: Math.round(revenue + conversionProbability * 2500),
    churnRisk,
    vip: revenue >= 50000 || completedOrders.length >= 10,
    intent
  };
}

export async function recordPaidOrderMemory(userId: string, order: { total: number; items: Array<Record<string, unknown>> }) {
  const categories = order.items.map((item) => String(item.category ?? item.category_id ?? "general"));
  await recordPurchase(userId, {
    amount: order.total,
    categories,
    items: order.items.map((item) => ({
      title: String(item.title ?? ""),
      category: String(item.category ?? item.category_id ?? "general"),
      size: item.selectedSize ? String(item.selectedSize) : undefined,
      color: item.selectedColor ? String(item.selectedColor) : undefined
    }))
  });
}

