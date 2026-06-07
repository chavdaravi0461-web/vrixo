import "server-only";
import { withRedis } from "@/lib/redis";
import { getClientIp } from "@/lib/rate-limit";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const KEY_PREFIX = "ratelimit:";

function buildKey(namespace: string, identifier: string): string {
  return `${KEY_PREFIX}${namespace}:${identifier}`;
}

export async function rateLimitValkey(
  namespace: string,
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  return withRedis(
    async (client) => {
      const key = buildKey(namespace, identifier);
      const now = Date.now();
      const windowStart = now - windowMs;

      const multi = client.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now, `${now}:${Math.random()}`);
      multi.expire(key, Math.ceil(windowMs / 1000) + 1);

      const results = await multi.exec();
      if (!results) {
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
      }

      const count = (results[1]?.[1] as number) ?? 0;
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = now + windowMs;

      return { allowed, remaining, resetAt };
    },
    { allowed: true, remaining: limit - 1, resetAt: Date.now() + windowMs }
  );
}

export async function checkValkeyRateLimit(
  request: Request,
  options: { key: string; limit: number; windowMs: number }
): Promise<{ allowed: boolean; retryAfter: number }> {
  const ip = getClientIp(request);
  const result = await rateLimitValkey(options.key, ip, options.limit, options.windowMs);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  return { allowed: true, retryAfter: 0 };
}
