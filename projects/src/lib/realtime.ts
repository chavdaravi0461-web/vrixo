import { withRedis } from "@/lib/redis";

export async function publishRealtime(channel: string, payload: unknown) {
  await withRedis(async (redis) => {
    await redis.publish(channel, JSON.stringify(payload));
    return true;
  }, false);
}

export { getRedis as default } from "@/lib/redis";
