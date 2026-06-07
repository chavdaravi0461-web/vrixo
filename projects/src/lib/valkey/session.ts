import "server-only";
import { withRedis } from "@/lib/redis";
import { randomUUID } from "node:crypto";

const SESSION_PREFIX = "session:";
const DEFAULT_SESSION_TTL = 3600; // 1 hour

type SessionData = Record<string, unknown>;

export const valkeySession = {
  async create(
    data: SessionData,
    ttlSeconds = DEFAULT_SESSION_TTL
  ): Promise<string> {
    const sessionId = randomUUID();

    await withRedis(
      async (client) => {
        await client.set(
          `${SESSION_PREFIX}${sessionId}`,
          JSON.stringify(data),
          "EX",
          ttlSeconds
        );
      },
      undefined
    );

    return sessionId;
  },

  async get<T extends SessionData = SessionData>(
    sessionId: string
  ): Promise<T | null> {
    return withRedis(
      async (client) => {
        const raw = await client.get(`${SESSION_PREFIX}${sessionId}`);
        return raw ? (JSON.parse(raw) as T) : null;
      },
      null
    );
  },

  async set(
    sessionId: string,
    data: SessionData,
    ttlSeconds?: number
  ): Promise<void> {
    await withRedis(
      async (client) => {
        const key = `${SESSION_PREFIX}${sessionId}`;
        if (ttlSeconds) {
          await client.set(key, JSON.stringify(data), "EX", ttlSeconds);
        } else {
          await client.set(key, JSON.stringify(data));
        }
      },
      undefined
    );
  },

  async extend(
    sessionId: string,
    ttlSeconds = DEFAULT_SESSION_TTL
  ): Promise<void> {
    await withRedis(
      async (client) => {
        await client.expire(`${SESSION_PREFIX}${sessionId}`, ttlSeconds);
      },
      undefined
    );
  },

  async delete(sessionId: string): Promise<void> {
    await withRedis(
      async (client) => {
        await client.del(`${SESSION_PREFIX}${sessionId}`);
      },
      undefined
    );
  },

  async exists(sessionId: string): Promise<boolean> {
    return withRedis(
      async (client) => {
        const result = await client.exists(`${SESSION_PREFIX}${sessionId}`);
        return result === 1;
      },
      false
    );
  },
};
