import IORedis, { type Redis } from "ioredis";
import { logger } from "@/lib/logger";
import { immortalRedis } from "@/lib/immortal-redis";
import { logInfo } from "@/lib/observability";
import { onShutdown } from "@/lib/graceful-shutdown";

let redis: Redis | null = null;
let redisDisabled = false;

export function isRedisAvailable(): boolean {
  if (redisDisabled) return false;
  if (redis) return true;
  const url = process.env.REDIS_URL || process.env.VALKEY_URL;
  if (!url) {
    redisDisabled = true;
    if (process.env.NODE_ENV !== "production") {
      console.log("[valkey] Valkey disabled — no REDIS_URL or VALKEY_URL set");
    }
    return false;
  }
  return true;
}

export function getRedis(): Redis | null {
  if (!isRedisAvailable()) return null;
  if (!redis) {
    const url = process.env.REDIS_URL || process.env.VALKEY_URL!;
    redis = new IORedis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000),
      keepAlive: 10_000,
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 250, 5000);
      },
      reconnectOnError(error) {
        const message = error.message.toLowerCase();
        return message.includes("readonly") || message.includes("connection");
      }
    });
    redis.on("error", (error) => {
      logger("warn", "redis.connection_error", { error: error.message });
    });
    redis.on("connect", () => {
      logInfo("redis.connected");
      immortalRedis.initialize(async () => redis).catch(() => undefined);
    });
    redis.on("reconnecting", () => logger("warn", "redis.reconnecting"));
    redis.on("end", () => logger("warn", "redis.connection_ended"));
  }

  return redis;
}

export async function ensureRedisConnected(): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  try {
    const client = getRedis();
    if (!client) return false;
    if (client.status === "end" || client.status === "close") {
      await client.connect();
    }
    if (client.status === "wait") {
      await client.connect();
    }
    return client.status === "ready" || client.status === "connect";
  } catch {
    return false;
  }
}

export async function withRedis<T>(operation: (client: Redis) => Promise<T>, fallback: T): Promise<T> {
  if (!isRedisAvailable()) return fallback;

  try {
    return await immortalRedis.withRedis(
      async () => {
        const client = getRedis();
        if (!client) throw new Error("Redis client unavailable");
        if (client.status === "end" || client.status === "close" || client.status === "wait") {
          await client.connect();
        }
        return await operation(client);
      },
      () => fallback,
      "redis-operation"
    );
  } catch (error) {
    logger("warn", "redis.operation_fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  return withRedis(async (client) => {
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }, null);
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number) {
  await withRedis(async (client) => {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  }, false);
}

// Register shutdown handler to close Redis cleanly on SIGTERM/SIGINT
onShutdown(async () => {
  if (redis) {
    logInfo("redis.shutdown_closing");
    await redis.quit();
    redis = null;
    logInfo("redis.shutdown_complete");
  }
});
