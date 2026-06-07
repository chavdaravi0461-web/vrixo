import "server-only";
import { withRedis } from "@/lib/redis";
import { captureAppError } from "@/lib/observability";
import { securityLog } from "@/lib/security";
import type { SupportIntent } from "./types";

export type IdempotencyRecord = {
  status: "pending" | "completed" | "failed";
  result: unknown;
  processedAt: string;
};

export type IdempotencyResult<T = unknown> = {
  isDuplicate: boolean;
  previousResult: T | null;
  shouldProceed: boolean;
  actionId: string;
};

const inFlight = new Map<string, Promise<unknown>>();
const MAX_IN_FLIGHT = 1000;

export function generateActionId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 12).replace(/-/g, "");
  return `act-${ts}-${rand}`;
}

export function buildIdempotencyKey(actionId: string): string {
  return `support:idempotency:${actionId}`;
}

export async function checkIdempotency<T = unknown>(
  actionId: string,
): Promise<IdempotencyResult<T>> {
  if (!actionId) {
    const generatedId = generateActionId();
    return { isDuplicate: false, previousResult: null, shouldProceed: true, actionId: generatedId };
  }

  const key = buildIdempotencyKey(actionId);

  const existing = await withRedis(async (redis) => {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  }, null);

  if (existing) {
    if (existing.status === "completed") {
      securityLog("idempotency.duplicate_completed", { actionId });
      return {
        isDuplicate: true,
        previousResult: existing.result as T,
        shouldProceed: false,
        actionId,
      };
    }

    if (existing.status === "pending") {
      const inFlightPromise = inFlight.get(actionId);
      if (inFlightPromise) {
        try {
          const result = await inFlightPromise;
          return {
            isDuplicate: true,
            previousResult: result as T,
            shouldProceed: false,
            actionId,
          };
        } catch {
          return { isDuplicate: true, previousResult: null, shouldProceed: false, actionId };
        }
      }
    }

    if (existing.status === "failed") {
      return { isDuplicate: false, previousResult: null, shouldProceed: true, actionId };
    }
  }

  await withRedis(async (redis) => {
    const record: IdempotencyRecord = {
      status: "pending",
      result: null,
      processedAt: new Date().toISOString(),
    };
    await redis.setex(key, 86400, JSON.stringify(record));
    return true;
  }, false);

  return { isDuplicate: false, previousResult: null, shouldProceed: true, actionId };
}

export async function markIdempotencyComplete<T>(
  actionId: string,
  result: T,
): Promise<void> {
  if (!actionId) return;

  const key = buildIdempotencyKey(actionId);
  const record: IdempotencyRecord = {
    status: "completed",
    result,
    processedAt: new Date().toISOString(),
  };

  await withRedis(async (redis) => {
    await redis.setex(key, 86400, JSON.stringify(record));
    return true;
  }, false);

  inFlight.delete(actionId);
}

export async function markIdempotencyFailed(
  actionId: string,
  error: string,
): Promise<void> {
  if (!actionId) return;

  const key = buildIdempotencyKey(actionId);
  const record: IdempotencyRecord = {
    status: "failed",
    result: error,
    processedAt: new Date().toISOString(),
  };

  await withRedis(async (redis) => {
    await redis.setex(key, 3600, JSON.stringify(record));
    return true;
  }, false);

  inFlight.delete(actionId);
}

export function trackInFlight(actionId: string, promise: Promise<unknown>): void {
  if (inFlight.size >= MAX_IN_FLIGHT) {
    const oldest = inFlight.keys().next().value;
    if (oldest) inFlight.delete(oldest);
  }
  inFlight.set(actionId, promise);
}

export async function isOrderConfirmationProcessed(
  orderNumber: string,
  intent: SupportIntent,
): Promise<boolean> {
  const key = `support:confirmed:${intent}:${orderNumber}`;
  return withRedis(async (redis) => {
    const exists = await redis.get(key);
    return exists !== null;
  }, false);
}

export async function markOrderConfirmationProcessed(
  orderNumber: string,
  intent: SupportIntent,
): Promise<void> {
  const key = `support:confirmed:${intent}:${orderNumber}`;
  await withRedis(async (redis) => {
    await redis.setex(key, 86400, "1");
    return true;
  }, false);
}

export async function releaseIdempotencyLock(actionId: string): Promise<void> {
  inFlight.delete(actionId);
}

export async function isRecentlyProcessed(
  orderNumber: string,
  intent: string,
  windowMs = 300_000,
): Promise<boolean> {
  const key = `support:recent:${intent}:${orderNumber}`;
  return withRedis(async (redis) => {
    const val = await redis.get(key);
    if (val) return true;
    await redis.setex(key, Math.ceil(windowMs / 1000), "1");
    return false;
  }, false);
}
