import "server-only";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";

const LOCK_PREFIX = "lock:";
const DEFAULT_TTL_SECONDS = 10;
const MAX_RETRIES = 20;
const RETRY_BASE_DELAY_MS = 50;
const RETRY_MAX_DELAY_MS = 2000;

interface Lock {
  key: string;
  owner: string;
  expiresAt: number;
  acquiredAt: number;
}

const heldLocks = new Map<string, Lock>();

export async function acquireLock(
  resource: string,
  options?: { ttlSeconds?: number; retryCount?: number; owner?: string },
): Promise<Lock | null> {
  const lockKey = `${LOCK_PREFIX}${resource}`;
  const owner = options?.owner ?? crypto.randomUUID();
  const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const maxRetries = options?.retryCount ?? MAX_RETRIES;
  const traceId = getTraceId();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const acquired = await withRedis(async (redis) => {
      const result = await redis.set(lockKey, owner, "PX", ttl * 1000, "NX");
      return result === "OK";
    }, false);

    if (acquired) {
      const lock: Lock = {
        key: lockKey,
        owner,
        expiresAt: Date.now() + ttl * 1000,
        acquiredAt: Date.now(),
      };
      heldLocks.set(lockKey, lock);

      logInfo("lock.acquired", { resource, owner, ttl, traceId, attempt: attempt + 1 });
      return lock;
    }

    const currentOwner = await withRedis(async (redis) => {
      return redis.get(lockKey);
    }, null as string | null);

    if (attempt < maxRetries - 1) {
      const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 50, RETRY_MAX_DELAY_MS);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logWarn("lock.acquire_failed", { resource, maxRetries, traceId });
  return null;
}

export async function releaseLock(lock: Lock | null): Promise<boolean> {
  if (!lock) return false;

  heldLocks.delete(lock.key);

  const released = await withRedis(async (redis) => {
    const result = await redis.eval(
      `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
      1,
      lock.key,
      lock.owner,
    );
    return result === 1;
  }, false);

  if (released) {
    logInfo("lock.released", { resource: lock.key.replace(LOCK_PREFIX, ""), owner: lock.owner, heldMs: Date.now() - lock.acquiredAt });
  } else {
    logWarn("lock.release_failed", { resource: lock.key.replace(LOCK_PREFIX, ""), owner: lock.owner });
  }

  return released;
}

export async function executeWithLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options?: { ttlSeconds?: number; retryCount?: number },
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const lock = await acquireLock(resource, options);
  if (!lock) {
    return { success: false, error: `Failed to acquire lock for resource: ${resource}` };
  }

  try {
    const result = await fn();
    return { success: true, data: result };
  } finally {
    await releaseLock(lock);
  }
}

export function getHeldLocks(): Lock[] {
  return Array.from(heldLocks.values());
}

export async function forceReleaseLock(resource: string): Promise<boolean> {
  const lockKey = `${LOCK_PREFIX}${resource}`;
  heldLocks.delete(lockKey);
  return withRedis(async (redis) => {
    await redis.del(lockKey);
    return true;
  }, false);
}
