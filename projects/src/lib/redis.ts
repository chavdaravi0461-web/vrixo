import IORedis, { type Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
    redis.on("error", (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[redis] connection unavailable", error.message);
      }
    });
  }

  return redis;
}

export async function withRedis<T>(operation: (client: Redis) => Promise<T>, fallback: T): Promise<T> {
  try {
    const client = getRedis();
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    }
    return await operation(client);
  } catch {
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

