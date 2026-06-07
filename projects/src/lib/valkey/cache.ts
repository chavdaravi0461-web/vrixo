import "server-only";
import { cacheGetJson as redisGet, cacheSetJson as redisSet } from "@/lib/redis";

type CacheOptions = {
  ttlSeconds: number;
  tags?: string[];
};

const TAG_INDEX_PREFIX = "cache:tag:";

async function tagIndexKey(tag: string): Promise<string> {
  return `${TAG_INDEX_PREFIX}${tag}`;
}

export const valkeyCache = {
  async get<T>(key: string): Promise<T | null> {
    return redisGet<T>(key);
  },

  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    await redisSet(key, value, options.ttlSeconds);

    if (options.tags?.length) {
      for (const tag of options.tags) {
        const setKey = await tagIndexKey(tag);
        try {
          const { getRedis } = await import("@/lib/redis");
          const client = getRedis();
          if (client) {
            await client.sadd(setKey, key);
            await client.expire(setKey, Math.max(options.ttlSeconds, 86400));
          }
        } catch {
          // tag index best-effort
        }
      }
    }
  },

  async getOrSet<T>(
    key: string,
    fetch: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetch();
    await this.set(key, value, options);
    return value;
  },

  async invalidateKey(key: string): Promise<void> {
    try {
      const { getRedis } = await import("@/lib/redis");
      const client = getRedis();
      if (client) {
        await client.del(key);
      }
    } catch {
      // best-effort
    }
  },

  async invalidateTag(tag: string): Promise<void> {
    try {
      const { getRedis } = await import("@/lib/redis");
      const client = getRedis();
      if (!client) return;

      const setKey = await tagIndexKey(tag);
      const keys = await client.smembers(setKey);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      await client.del(setKey);
    } catch {
      // best-effort
    }
  },

  async invalidateTags(tags: string[]): Promise<void> {
    await Promise.all(tags.map((tag) => this.invalidateTag(tag)));
  },
};
