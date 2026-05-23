import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { captureAppError, logInfo } from "@/lib/observability";

export type AppEventType =
  | "order.created"
  | "order.confirmed"
  | "order.updated"
  | "payment.risk_review"
  | "payment.blocked"
  | "payment.captured"
  | "fraud.alert"
  | "whatsapp.event"
  | "customer.activity"
  | "support.message"
  | "admin.alert"
  | "queue.failed"
  | "ai.failure"
  | "webhook.received"
  | "webhook.verified"
  | "webhook.verification_failed";

export type AppEvent = {
  id: string;
  type: AppEventType;
  severity: "info" | "warn" | "critical";
  entityId?: string | null;
  entityType?: string | null;
  customerId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export const REALTIME_CHANNEL = process.env.VRIXO_REALTIME_CHANNEL || "vrixo:events";

export async function publishEvent(input: Omit<AppEvent, "id" | "createdAt">) {
  const event: AppEvent = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };

  await Promise.all([
    persistEvent(event),
    withRedis(async (client) => {
      await client.publish(REALTIME_CHANNEL, JSON.stringify(event));
      await client.lpush("vrixo:events:recent", JSON.stringify(event));
      await client.ltrim("vrixo:events:recent", 0, 199);
      return true;
    }, false)
  ]);

  logInfo("event.published", { type: event.type, entityId: event.entityId });
  return event;
}

export async function getRecentEvents(limit = 100) {
  const cached = await withRedis(async (client) => {
    const rows = await client.lrange("vrixo:events:recent", 0, limit - 1);
    return rows.map((row) => JSON.parse(row) as AppEvent);
  }, [] as AppEvent[]);

  if (cached.length > 0) return cached;

  try {
    const { data } = await createAdminClient()
      .from("app_events")
      .select("id, type, severity, entity_id, entity_type, customer_id, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      type: row.type as AppEventType,
      severity: row.severity as AppEvent["severity"],
      entityId: row.entity_id,
      entityType: row.entity_type,
      customerId: row.customer_id,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: row.created_at
    }));
  } catch {
    return [];
  }
}

async function persistEvent(event: AppEvent) {
  try {
    await createAdminClient().from("app_events").insert({
      id: event.id,
      type: event.type,
      severity: event.severity,
      entity_id: event.entityId ?? null,
      entity_type: event.entityType ?? null,
      customer_id: event.customerId ?? null,
      payload: event.payload,
      created_at: event.createdAt
    });
  } catch (error) {
    captureAppError(error, { area: "event_bus.persist", type: event.type });
  }
}

