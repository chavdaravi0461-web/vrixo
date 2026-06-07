import "server-only";
import { withRedis } from "@/lib/redis";
import { securityLog } from "@/lib/security";

export type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
};

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  cooldownMs?: number;
};

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  cancel: { windowMs: 60_000, maxRequests: 3, cooldownMs: 300_000 },
  refund: { windowMs: 60_000, maxRequests: 2, cooldownMs: 600_000 },
  return: { windowMs: 60_000, maxRequests: 2, cooldownMs: 600_000 },
  support_message: { windowMs: 10_000, maxRequests: 5, cooldownMs: 30_000 },
  confirmation: { windowMs: 60_000, maxRequests: 5, cooldownMs: 120_000 },
  order_lookup: { windowMs: 30_000, maxRequests: 10, cooldownMs: 60_000 },
};

const memoryFallback = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();

function buildKey(category: string, identifier: string): string {
  return `support:ratelimit:${category}:${identifier}`;
}

async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  return withRedis(async (redis) => {
    const now = Date.now();
    const cooldownKey = `${key}:cooldown`;

    const cooldownUntil = await redis.get(cooldownKey);
    if (cooldownUntil) {
      const remaining = parseInt(cooldownUntil, 10) - Math.floor(now / 1000);
      if (remaining > 0) {
        return { allowed: false, retryAfter: remaining, reason: "cooldown_active" };
      }
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, config.windowMs);
    }

    if (current > config.maxRequests) {
      if (config.cooldownMs) {
        const cooldownUntilSec = Math.floor((now + config.cooldownMs) / 1000);
        await redis.setex(cooldownKey, Math.ceil(config.cooldownMs / 1000), String(cooldownUntilSec));
      }
      securityLog("ratelimit.exceeded", { key, count: current, max: config.maxRequests });
      return { allowed: false, retryAfter: Math.ceil(config.windowMs / 1000), reason: "rate_limit_exceeded" };
    }

    return { allowed: true };
  }, { allowed: true });
}

function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const existing = memoryFallback.get(key);

  if (existing) {
    if (existing.blockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((existing.blockedUntil - now) / 1000), reason: "cooldown_active" };
    }

    if (existing.resetAt <= now) {
      memoryFallback.set(key, { count: 1, resetAt: now + config.windowMs, blockedUntil: 0 });
      return { allowed: true };
    }

    existing.count += 1;
    if (existing.count > config.maxRequests) {
      if (config.cooldownMs) {
        existing.blockedUntil = now + config.cooldownMs;
      }
      securityLog("ratelimit.exceeded_memory", { key, count: existing.count, max: config.maxRequests });
      return { allowed: false, retryAfter: Math.ceil(config.windowMs / 1000), reason: "rate_limit_exceeded" };
    }

    return { allowed: true };
  }

  memoryFallback.set(key, { count: 1, resetAt: now + config.windowMs, blockedUntil: 0 });
  return { allowed: true };
}

export async function checkSupportRateLimit(
  category: string,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[category];
  if (!config) {
    return { allowed: true };
  }

  const key = buildKey(category, identifier);
  const redisResult = await checkRedisRateLimit(key, config);
  if (!redisResult.allowed) {
    return redisResult;
  }

  return checkMemoryRateLimit(key, config);
}

export async function checkCancellationRateLimit(phone: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("cancel", phone);
}

export async function checkRefundRateLimit(phone: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("refund", phone);
}

export async function checkReturnRateLimit(phone: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("return", phone);
}

export async function checkSupportSpamRateLimit(phone: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("support_message", phone);
}

export async function checkConfirmationRateLimit(phone: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("confirmation", phone);
}

export async function checkOrderLookupRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkSupportRateLimit("order_lookup", identifier);
}

export function resetRateLimitMemoryFallback(): void {
  memoryFallback.clear();
}
