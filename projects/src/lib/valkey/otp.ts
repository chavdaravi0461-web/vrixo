import "server-only";
import { withRedis } from "@/lib/redis";

const OTP_PREFIX = "otp:";
const OTP_ATTEMPT_PREFIX = "otp:attempt:";
const OTP_BLOCK_PREFIX = "otp:block:";
const DEFAULT_TTL = 300; // 5 minutes
const MAX_ATTEMPTS = 3;
const BLOCK_TTL = 900; // 15 minutes

export const valkeyOtp = {
  async store(phone: string, codeHash: string, ttlSeconds = DEFAULT_TTL): Promise<void> {
    await withRedis(
      async (client) => {
        const multi = client.multi();
        multi.set(`${OTP_PREFIX}${phone}`, codeHash, "EX", ttlSeconds);
        multi.set(`${OTP_ATTEMPT_PREFIX}${phone}`, "0", "EX", ttlSeconds);
        multi.del(`${OTP_BLOCK_PREFIX}${phone}`);
        await multi.exec();
      },
      undefined
    );
  },

  async getCodeHash(phone: string): Promise<string | null> {
    return withRedis(
      async (client) => client.get(`${OTP_PREFIX}${phone}`),
      null
    );
  },

  async getAttempts(phone: string): Promise<number> {
    return withRedis(
      async (client) => {
        const val = await client.get(`${OTP_ATTEMPT_PREFIX}${phone}`);
        return val ? parseInt(val, 10) : 0;
      },
      0
    );
  },

  async incrementAttempt(phone: string): Promise<number> {
    return withRedis(
      async (client) => {
        const attempts = await client.incr(`${OTP_ATTEMPT_PREFIX}${phone}`);
        const ttl = await client.ttl(`${OTP_ATTEMPT_PREFIX}${phone}`);
        if (ttl < 0) {
          await client.expire(`${OTP_ATTEMPT_PREFIX}${phone}`, DEFAULT_TTL);
        }
        if (attempts >= MAX_ATTEMPTS) {
          await client.set(`${OTP_BLOCK_PREFIX}${phone}`, "1", "EX", BLOCK_TTL);
        }
        return attempts;
      },
      0
    );
  },

  async isBlocked(phone: string): Promise<boolean> {
    return withRedis(
      async (client) => {
        const val = await client.get(`${OTP_BLOCK_PREFIX}${phone}`);
        return val !== null;
      },
      false
    );
  },

  async delete(phone: string): Promise<void> {
    await withRedis(
      async (client) => {
        await client.del(
          `${OTP_PREFIX}${phone}`,
          `${OTP_ATTEMPT_PREFIX}${phone}`,
          `${OTP_BLOCK_PREFIX}${phone}`
        );
      },
      undefined
    );
  },
};
