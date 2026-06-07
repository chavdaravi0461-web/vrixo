import "server-only";
import { withRedis } from "@/lib/redis";
import { securityLog } from "@/lib/security";
import type { SupportIntent } from "./types";

export type PendingConfirmation = {
  id: string;
  intent: SupportIntent;
  orderNumber: string;
  customerPhone: string;
  customerUserId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  confirmed: boolean;
  executed: boolean;
};

const CONFIRMATION_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 86400;

function buildConfirmationKey(id: string): string {
  return `support:confirmation:${id}`;
}

function buildSessionKey(identifier: string): string {
  return `support:session:${identifier}`;
}

function buildPendingKey(phone: string): string {
  return `support:pending:${phone}`;
}

export async function createPendingConfirmation(params: {
  intent: SupportIntent;
  orderNumber: string;
  customerPhone: string;
  customerUserId?: string | null;
  data?: Record<string, unknown>;
}): Promise<PendingConfirmation> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_SECONDS * 1000);

  const confirmation: PendingConfirmation = {
    id,
    intent: params.intent,
    orderNumber: params.orderNumber,
    customerPhone: params.customerPhone,
    customerUserId: params.customerUserId ?? null,
    data: params.data ?? {},
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmed: false,
    executed: false,
  };

  const key = buildConfirmationKey(id);
  await withRedis(async (redis) => {
    await redis.setex(key, CONFIRMATION_TTL_SECONDS, JSON.stringify(confirmation));
    return true;
  }, false);

  const pendingKey = buildPendingKey(params.customerPhone);
  await withRedis(async (redis) => {
    await redis.sadd(pendingKey, id);
    await redis.expire(pendingKey, CONFIRMATION_TTL_SECONDS);
    return true;
  }, false);

  securityLog("session.confirmation_created", {
    id,
    intent: params.intent,
    orderNumber: params.orderNumber,
  });

  return confirmation;
}

export async function getPendingConfirmation(
  id: string,
): Promise<PendingConfirmation | null> {
  const key = buildConfirmationKey(id);
  return withRedis(async (redis) => {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as PendingConfirmation;
  }, null);
}

export async function confirmPendingConfirmation(
  id: string,
): Promise<{ success: boolean; confirmation?: PendingConfirmation; reason?: string }> {
  const confirmation = await getPendingConfirmation(id);
  if (!confirmation) {
    return { success: false, reason: "Confirmation not found or expired" };
  }

  if (new Date(confirmation.expiresAt) < new Date()) {
    await deletePendingConfirmation(id, confirmation.customerPhone);
    return { success: false, reason: "Confirmation has expired" };
  }

  if (confirmation.executed) {
    return { success: false, reason: "Confirmation already executed" };
  }

  confirmation.confirmed = true;
  const key = buildConfirmationKey(id);
  await withRedis(async (redis) => {
    await redis.setex(key, CONFIRMATION_TTL_SECONDS, JSON.stringify(confirmation));
    return true;
  }, false);

  return { success: true, confirmation };
}

export async function markConfirmationExecuted(
  id: string,
  phone: string,
): Promise<void> {
  const key = buildConfirmationKey(id);
  await withRedis(async (redis) => {
    const raw = await redis.get(key);
    if (raw) {
      const confirmation = JSON.parse(raw) as PendingConfirmation;
      confirmation.executed = true;
      await redis.setex(key, 60, JSON.stringify(confirmation));
    }
    return true;
  }, false);

  const pendingKey = buildPendingKey(phone);
  await withRedis(async (redis) => {
    await redis.srem(pendingKey, id);
    return true;
  }, false);
}

export async function deletePendingConfirmation(
  id: string,
  phone: string,
): Promise<void> {
  const key = buildConfirmationKey(id);
  await withRedis(async (redis) => {
    await redis.del(key);
    return true;
  }, false);

  const pendingKey = buildPendingKey(phone);
  await withRedis(async (redis) => {
    await redis.srem(pendingKey, id);
    return true;
  }, false);
}

export async function getPendingConfirmationsForPhone(
  phone: string,
): Promise<PendingConfirmation[]> {
  const pendingKey = buildPendingKey(phone);
  const ids = await withRedis(async (redis) => {
    return redis.smembers(pendingKey);
  }, [] as string[]);

  if (ids.length === 0) return [];

  const results: PendingConfirmation[] = [];
  for (const id of ids) {
    const confirmation = await getPendingConfirmation(id);
    if (confirmation && new Date(confirmation.expiresAt) > new Date() && !confirmation.executed) {
      results.push(confirmation);
    }
  }

  return results;
}

export async function expireStaleConfirmations(): Promise<number> {
  const key = "support:confirmation:cleanup:scan";
  let expiredCount = 0;

  await withRedis(async (redis) => {
    const cursor = "0";
    let scanCursor = cursor;
    do {
      const [nextCursor, keys] = await redis.scan(
        scanCursor,
        "MATCH",
        "support:confirmation:*",
        "COUNT",
        100,
      );
      scanCursor = nextCursor;

      for (const k of keys) {
        const raw = await redis.get(k);
        if (raw) {
          try {
            const confirmation = JSON.parse(raw) as PendingConfirmation;
            if (new Date(confirmation.expiresAt) < new Date()) {
              await redis.del(k);
              const pendingKey = buildPendingKey(confirmation.customerPhone);
              await redis.srem(pendingKey, confirmation.id);
              expiredCount++;
            }
          } catch {
            await redis.del(k);
          }
        }
      }
    } while (scanCursor !== "0");
    return true;
  }, false);

  return expiredCount;
}

export async function saveSessionState(
  identifier: string,
  state: Record<string, unknown>,
): Promise<void> {
  const key = buildSessionKey(identifier);
  await withRedis(async (redis) => {
    const existing = await redis.get(key);
    const current = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
    const merged = { ...current, ...state, updatedAt: new Date().toISOString() };
    await redis.setex(key, SESSION_TTL_SECONDS, JSON.stringify(merged));
    return true;
  }, false);
}

export async function getSessionState(
  identifier: string,
): Promise<Record<string, unknown> | null> {
  const key = buildSessionKey(identifier);
  return withRedis(async (redis) => {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }, null);
}

export async function clearSessionState(identifier: string): Promise<void> {
  const key = buildSessionKey(identifier);
  await withRedis(async (redis) => {
    await redis.del(key);
    return true;
  }, false);
}

export async function clearAllConfirmationsForPhone(phone: string): Promise<void> {
  const pendingKey = buildPendingKey(phone);
  const ids = await withRedis(async (redis) => {
    return redis.smembers(pendingKey);
  }, [] as string[]);

  for (const id of ids) {
    const key = buildConfirmationKey(id);
    await withRedis(async (redis) => {
      await redis.del(key);
      return true;
    }, false);
  }

  await withRedis(async (redis) => {
    await redis.del(pendingKey);
    return true;
  }, false);
}
