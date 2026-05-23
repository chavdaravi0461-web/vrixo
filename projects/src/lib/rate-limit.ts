import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  identifier?: string | null;
};

type Bucket = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const memoryBuckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 500) ?? "";
}

export async function checkServerRateLimit(request: Request, options: RateLimitOptions) {
  const subject = `${options.key}:${getClientIp(request)}:${options.identifier ?? "anonymous"}`;

  if (hasServerSupabaseAdminEnv()) {
    try {
      return await checkDatabaseRateLimit(subject, options);
    } catch {
      return checkMemoryRateLimit(subject, options);
    }
  }

  return checkMemoryRateLimit(subject, options);
}

async function checkDatabaseRateLimit(subject: string, options: RateLimitOptions) {
  const supabase = createAdminClient();
  const now = Date.now();
  const resetAt = new Date(now + options.windowMs).toISOString();
  const table = options.key.startsWith("admin") ? "admin_rate_limits" : "rate_limits";

  const { data: current } = await supabase
    .from(table)
    .select("attempt_count, reset_at, blocked_until")
    .eq("key", subject)
    .maybeSingle();

  const blockedUntil = current?.blocked_until ? new Date(current.blocked_until).getTime() : 0;
  if (blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((blockedUntil - now) / 1000) };
  }

  const currentReset = current?.reset_at ? new Date(current.reset_at).getTime() : 0;
  const count = current && currentReset > now ? Number(current.attempt_count ?? 0) + 1 : 1;
  const nextBlockedUntil =
    count > options.limit ? new Date(now + options.windowMs).toISOString() : null;

  await supabase.from(table).upsert(
    {
      key: subject,
      attempt_count: count,
      reset_at: currentReset > now ? current?.reset_at : resetAt,
      blocked_until: nextBlockedUntil,
      updated_at: new Date(now).toISOString()
    },
    { onConflict: "key" }
  );

  if (count > options.limit) {
    return { allowed: false, retryAfter: Math.ceil(options.windowMs / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

function checkMemoryRateLimit(subject: string, options: RateLimitOptions) {
  const now = Date.now();
  const current = memoryBuckets.get(subject);

  if (current?.blockedUntil && current.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((current.blockedUntil - now) / 1000) };
  }

  if (!current || current.resetAt <= now) {
    memoryBuckets.set(subject, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;

  if (current.count > options.limit) {
    current.blockedUntil = now + options.windowMs;
    return { allowed: false, retryAfter: Math.ceil(options.windowMs / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

export async function clearServerRateLimit(options: { key: string; request: Request; identifier?: string | null }) {
  const subject = `${options.key}:${getClientIp(options.request)}:${options.identifier ?? "anonymous"}`;
  memoryBuckets.delete(subject);

  if (!hasServerSupabaseAdminEnv()) return;

  try {
    const table = options.key.startsWith("admin") ? "admin_rate_limits" : "rate_limits";
    await createAdminClient().from(table).delete().eq("key", subject);
  } catch {
    // Rate-limit cleanup must never break a successful login.
  }
}
