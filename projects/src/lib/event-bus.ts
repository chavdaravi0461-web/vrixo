import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { captureAppError, logInfo, logWarn, logError } from "@/lib/observability";
import { createCircuitBreaker } from "@/lib/circuit-breaker";
import { getTraceId } from "@/lib/trace-context";
import { reportEventBufferDepth } from "@/lib/backpressure";
import { recordFailure } from "@/lib/failure-metrics";
import { onShutdown } from "@/lib/graceful-shutdown";
import { securityLog } from "@/lib/security";

const eventBusCircuit = createCircuitBreaker("event-bus", {
  failureThreshold: 5,
  cooldownMs: 15_000,
  name: "event-bus",
});

export type AppEventType =
  | "order.created"
  | "order.confirmed"
  | "order.updated"
  | "payment.risk_review"
  | "payment.blocked"
  | "payment.captured"
  | "payment.create"
  | "payment.capture"
  | "payment.refund"
  | "payment.verify"
  | "payment.void"
  | "payment.ledger"
  | "inventory.reserved"
  | "inventory.confirmed"
  | "inventory.released"
  | "cron.executed"
  | "dlq.recorded"
  | "fraud.alert"
  | "whatsapp.event"
  | "customer.activity"
  | "support.message"
  | "admin.alert"
  | "queue.failed"
  | "ai.failure"
  | "webhook.received"
  | "webhook.verified"
  | "webhook.verification_failed"
  | "healing.action"
  | "system.anomaly";

export type AppEvent = {
  id: string;
  type: AppEventType;
  severity: "info" | "warn" | "critical";
  entityId?: string | null;
  entityType?: string | null;
  customerId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  traceId?: string;
};

export const REALTIME_CHANNEL = process.env.VRIXO_REALTIME_CHANNEL || "vrixo:events";

const HIGH_SEVERITY: Set<AppEventType> = new Set([
  "payment.risk_review", "payment.blocked", "fraud.alert",
  "admin.alert", "queue.failed", "ai.failure", "system.anomaly",
]);

const eventBuffer: AppEvent[] = [];
const BUFFER_FLUSH_INTERVAL = 500;
const BUFFER_MAX_SIZE = 500;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushInProgress = false;

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushBuffer().catch(() => undefined);
  }, BUFFER_FLUSH_INTERVAL);
}

async function flushBuffer(): Promise<void> {
  if (flushInProgress || eventBuffer.length === 0) return;
  flushInProgress = true;

  const batchSize = Math.min(eventBuffer.length, 100);
  const batch = eventBuffer.splice(0, batchSize);
  reportEventBufferDepth(eventBuffer.length);

  try {
    await persistEventBatch(batch);
  } catch (error) {
    eventBuffer.unshift(...batch);
    reportEventBufferDepth(eventBuffer.length);
    if (eventBuffer.length > BUFFER_MAX_SIZE) {
      const dropped = eventBuffer.splice(BUFFER_MAX_SIZE, eventBuffer.length - BUFFER_MAX_SIZE);
      logWarn("event_bus.buffer_overflow", { dropped: dropped.length });
      recordFailure("event-bus", "buffer_overflow");
    }
  } finally {
    flushInProgress = false;
  }
}

async function persistEventBatch(events: AppEvent[]): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_events").insert(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      entity_id: e.entityId ?? null,
      entity_type: e.entityType ?? null,
      customer_id: e.customerId ?? null,
      payload: e.payload,
      created_at: e.createdAt,
    }))
  );
  if (error) {
    logWarn("event_bus.batch_persist_failed", { count: events.length, error: error.message });
    throw error;
  }
}

async function publishToRedis(event: AppEvent): Promise<void> {
  await eventBusCircuit.call(
    async () => withRedis(async (client) => {
      await client.publish(REALTIME_CHANNEL, JSON.stringify(event));
      if (HIGH_SEVERITY.has(event.type)) {
        await client.lpush("vrixo:events:critical", JSON.stringify(event));
        await client.ltrim("vrixo:events:critical", 0, 999);
      }
      await client.lpush("vrixo:events:recent", JSON.stringify(event));
      await client.ltrim("vrixo:events:recent", 0, 199);
      return true;
    }, false),
    async () => {
      logWarn("event_bus.redis_circuit_open", { type: event.type });
      return false;
    },
  );
}

export async function publishEvent(input: Omit<AppEvent, "id" | "createdAt">): Promise<AppEvent> {
  const event: AppEvent = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    traceId: getTraceId(),
  };

  ensureFlushTimer();

  // Enforce max buffer — drop oldest if at capacity
  if (eventBuffer.length >= BUFFER_MAX_SIZE) {
    const dropped = eventBuffer.splice(0, eventBuffer.length - BUFFER_MAX_SIZE + 1);
    logWarn("event_bus.buffer_full", { dropped: dropped.length });
    recordFailure("event-bus", "buffer_overflow");
    securityLog("event-bus.buffer_overflow", { droppedCount: dropped.length });
  }

  eventBuffer.push(event);
  reportEventBufferDepth(eventBuffer.length);

  if (eventBuffer.length >= 100 || HIGH_SEVERITY.has(event.type)) {
    flushBuffer().catch(() => undefined);
  }

  if (HIGH_SEVERITY.has(event.type)) {
    await publishToRedis(event);
  }

  logInfo("event.published", { type: event.type, entityId: event.entityId, traceId: event.traceId });
  return event;
}

export async function getRecentEvents(limit = 100) {
  const cached = await withRedis(async (client) => {
    const critical = await client.lrange("vrixo:events:critical", 0, 9);
    const recent = await client.lrange("vrixo:events:recent", 0, Math.max(limit - critical.length - 1, 0));
    return [...critical, ...recent].map((row) => JSON.parse(row) as AppEvent);
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
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export function getEventBufferStats() {
  return { buffered: eventBuffer.length, maxSize: BUFFER_MAX_SIZE, flushIntervalMs: BUFFER_FLUSH_INTERVAL };
}

// Register shutdown handler to drain event buffer before exit
onShutdown(async () => {
  logInfo("event_bus.shutdown_draining", { remaining: eventBuffer.length, flushIntervalMs: BUFFER_FLUSH_INTERVAL });
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (eventBuffer.length > 0) {
    await flushBuffer();
  }
  logInfo("event_bus.shutdown_complete", { drained: true });
});
