import "server-only";
import { withRedis } from "@/lib/redis";
import { publishEvent } from "@/lib/event-bus";
import { captureAppError, logInfo, logWarn, logError } from "@/lib/observability";
import type { SupportIntent, ExecutionResult, SupportContext } from "./types";

type MetricPoint = {
  count: number;
  totalLatency: number;
  failures: number;
  lastTimestamp: number;
};

const metrics = new Map<string, MetricPoint>();
const METRICS_FLUSH_INTERVAL = 60_000;
const METRICS_MAX_KEYS = 1000;

let metricsTimer: ReturnType<typeof setInterval> | null = null;

function ensureMetricsTimer(): void {
  if (metricsTimer) return;
  metricsTimer = setInterval(() => {
    flushMetrics().catch(() => undefined);
  }, METRICS_FLUSH_INTERVAL);
}

function getMetricKey(intent: string, action: string): string {
  return `support:metrics:${intent}:${action}`;
}

export function recordIntent(
  intent: SupportIntent,
  context: string,
  latencyMs: number,
  success: boolean,
): void {
  ensureMetricsTimer();
  const key = getMetricKey(intent, context);
  const existing = metrics.get(key) ?? { count: 0, totalLatency: 0, failures: 0, lastTimestamp: 0 };
  existing.count += 1;
  existing.totalLatency += latencyMs;
  if (!success) existing.failures += 1;
  existing.lastTimestamp = Date.now();
  metrics.set(key, existing);

  if (metrics.size > METRICS_MAX_KEYS) {
    const oldest = metrics.keys().next().value;
    if (oldest) metrics.delete(oldest);
  }
}

export function recordDestructiveAction(
  intent: SupportIntent,
  success: boolean,
  orderNumber: string,
  latencyMs: number,
  customerPhone?: string,
): void {
  recordIntent(intent, success ? "executed" : "failed", latencyMs, success);

  logInfo("support.destructive_action", {
    intent,
    success,
    orderNumber,
    latencyMs,
    customerPhone: customerPhone ? `***${customerPhone.slice(-4)}` : undefined,
  });

  publishEvent({
    type: success ? "order.updated" : "support.message",
    severity: success ? "info" : "warn",
    entityId: orderNumber,
    entityType: "order",
    payload: { intent, action: success ? "executed" : "failed", latencyMs },
  }).catch(() => undefined);
}

export function recordConfirmationConversion(
  intent: SupportIntent,
  converted: boolean,
  orderNumber: string,
): void {
  const key = `support:confirmation:${intent}:${converted ? "converted" : "abandoned"}`;
  const existing = metrics.get(key) ?? { count: 0, totalLatency: 0, failures: 0, lastTimestamp: 0 };
  existing.count += 1;
  existing.lastTimestamp = Date.now();
  metrics.set(key, existing);

  logInfo("support.confirmation", {
    intent,
    converted,
    orderNumber,
  });
}

export function recordSupportFailure(
  intent: SupportIntent,
  error: string,
  orderNumber?: string,
): void {
  const key = getMetricKey(intent, "failure");
  const existing = metrics.get(key) ?? { count: 0, totalLatency: 0, failures: 0, lastTimestamp: 0 };
  existing.failures += 1;
  existing.lastTimestamp = Date.now();
  metrics.set(key, existing);

  logError("support.failure", { intent, error, orderNumber });
  captureAppError(new Error(`Support failure: ${error}`), { intent, orderNumber });
}

export async function flushMetrics(): Promise<void> {
  if (metrics.size === 0) return;

  const snapshot = new Map(metrics);
  metrics.clear();

  const redisKey = "support:metrics:aggregated";
  await withRedis(async (redis) => {
    const existing = await redis.get(redisKey);
    const aggregated = existing ? (JSON.parse(existing) as Record<string, MetricPoint>) : {};

    for (const [key, point] of snapshot) {
      const existingPoint = aggregated[key] ?? { count: 0, totalLatency: 0, failures: 0, lastTimestamp: 0 };
      aggregated[key] = {
        count: existingPoint.count + point.count,
        totalLatency: existingPoint.totalLatency + point.totalLatency,
        failures: existingPoint.failures + point.failures,
        lastTimestamp: Math.max(existingPoint.lastTimestamp, point.lastTimestamp),
      };
    }

    await redis.setex(redisKey, 86400, JSON.stringify(aggregated));
    return true;
  }, false);
}

export async function getSupportMetrics(): Promise<{
  intentFrequency: Record<string, number>;
  failedActions: Record<string, number>;
  confirmationConversion: Record<string, { converted: number; abandoned: number }>;
  executionLatency: Record<string, number>;
  supportFailures: number;
  totalRequests: number;
  totalFailures: number;
}> {
  const result = {
    intentFrequency: {} as Record<string, number>,
    failedActions: {} as Record<string, number>,
    confirmationConversion: {} as Record<string, { converted: number; abandoned: number }>,
    executionLatency: {} as Record<string, number>,
    supportFailures: 0,
    totalRequests: 0,
    totalFailures: 0,
  };

  for (const [key, point] of metrics) {
    const parts = key.split(":");
    const intent = parts[2] ?? "unknown";
    const action = parts[3] ?? "unknown";

    result.intentFrequency[intent] = (result.intentFrequency[intent] ?? 0) + point.count;
    if (action === "failure" || (!action.includes("executed") && point.failures > 0)) {
      result.failedActions[intent] = (result.failedActions[intent] ?? 0) + point.failures;
    }
    result.executionLatency[intent] = point.count > 0
      ? Math.round(point.totalLatency / point.count)
      : 0;

    if (key.includes("confirmation")) {
      const convKey = parts.slice(2, 3).join(":");
      if (!result.confirmationConversion[convKey]) {
        result.confirmationConversion[convKey] = { converted: 0, abandoned: 0 };
      }
      if (action === "converted") {
        result.confirmationConversion[convKey].converted += point.count;
      } else {
        result.confirmationConversion[convKey].abandoned += point.count;
      }
    }

    result.totalRequests += point.count;
    result.totalFailures += point.failures;
  }

  result.supportFailures = result.totalFailures;

  return result;
}

export async function trackExecutionLatency<T>(
  intent: SupportIntent,
  fn: () => Promise<T>,
  context?: SupportContext,
): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  try {
    const result = await fn();
    const latencyMs = Math.round(performance.now() - start);
    recordIntent(intent, "executed", latencyMs, true);
    return { result, latencyMs };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    recordIntent(intent, "failed", latencyMs, false);
    recordSupportFailure(intent, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function getMetricsFromRedis(): Promise<Record<string, MetricPoint>> {
  return withRedis(async (redis) => {
    const raw = await redis.get("support:metrics:aggregated");
    return raw ? (JSON.parse(raw) as Record<string, MetricPoint>) : {};
  }, {});
}

export function getInMemoryMetricCount(): number {
  return metrics.size;
}
