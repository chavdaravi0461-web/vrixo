import { withRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export type WhatsAppRedisLog = {
  orderId: string;
  orderNumber?: string;
  jobId?: string;
  channel: string;
  attempt: number;
  status: "queued" | "sent" | "failed" | "skipped" | "error";
  messageId?: string;
  adminMessageId?: string;
  error?: string;
  response?: unknown;
  createdAt: string;
};

const LOG_TTL_SECONDS = Number(process.env.WHATSAPP_LOG_TTL_SECONDS ?? 60 * 60 * 24 * 30);
const MAX_ORDER_LOGS = Number(process.env.WHATSAPP_MAX_LOGS_PER_ORDER ?? 100);
const MAX_TIMELINE_LOGS = Number(process.env.WHATSAPP_MAX_TIMELINE_LOGS ?? 2000);

export async function saveWhatsAppLog(entry: Omit<WhatsAppRedisLog, "createdAt">) {
  const log: WhatsAppRedisLog = {
    ...entry,
    createdAt: new Date().toISOString()
  };

  const saved = await withRedis(async (redis) => {
    const orderKey = whatsappOrderLogKey(log.orderId);
    const jobKey = log.jobId ? whatsappJobLogKey(log.jobId) : null;
    const payload = JSON.stringify(log);

    const pipeline = redis.pipeline();
    pipeline.lpush(orderKey, payload);
    pipeline.ltrim(orderKey, 0, MAX_ORDER_LOGS - 1);
    pipeline.expire(orderKey, LOG_TTL_SECONDS);
    pipeline.zadd(whatsappTimelineKey(), Date.now(), payload);
    pipeline.zremrangebyrank(whatsappTimelineKey(), 0, -(MAX_TIMELINE_LOGS + 1));

    if (jobKey) {
      pipeline.lpush(jobKey, payload);
      pipeline.ltrim(jobKey, 0, MAX_ORDER_LOGS - 1);
      pipeline.expire(jobKey, LOG_TTL_SECONDS);
    }

    if (log.status === "failed" || log.status === "error") {
      pipeline.lpush(whatsappFailedLogKey(), payload);
      pipeline.ltrim(whatsappFailedLogKey(), 0, 999);
      pipeline.expire(whatsappFailedLogKey(), LOG_TTL_SECONDS);
    }

    await pipeline.exec();
    return true;
  }, false);

  if (!saved) {
    logger("warn", "whatsapp.redis_log_failed", {
      orderId: entry.orderId,
      jobId: entry.jobId,
      status: entry.status
    });
  }

  return saved;
}

export async function getWhatsAppOrderLogs(orderId: string) {
  return withRedis(async (redis) => {
    const values = await redis.lrange(whatsappOrderLogKey(orderId), 0, MAX_ORDER_LOGS - 1);
    return values.map(parseLog).filter(Boolean) as WhatsAppRedisLog[];
  }, [] as WhatsAppRedisLog[]);
}

export async function getWhatsAppFailedLogs(limit = 100) {
  return withRedis(async (redis) => {
    const values = await redis.lrange(whatsappFailedLogKey(), 0, Math.max(0, limit - 1));
    return values.map(parseLog).filter(Boolean) as WhatsAppRedisLog[];
  }, [] as WhatsAppRedisLog[]);
}

export async function getWhatsAppRecentLogs(limit = 200) {
  return withRedis(async (redis) => {
    const values = await redis.zrevrange(whatsappTimelineKey(), 0, Math.max(0, limit - 1));
    return values.map(parseLog).filter(Boolean) as WhatsAppRedisLog[];
  }, [] as WhatsAppRedisLog[]);
}

function parseLog(value: string): WhatsAppRedisLog | null {
  try {
    return JSON.parse(value) as WhatsAppRedisLog;
  } catch {
    return null;
  }
}

function whatsappOrderLogKey(orderId: string) {
  return `whatsapp:order:${orderId}:logs`;
}

function whatsappJobLogKey(jobId: string) {
  return `whatsapp:job:${jobId}:logs`;
}

function whatsappTimelineKey() {
  return "whatsapp:logs:timeline";
}

function whatsappFailedLogKey() {
  return "whatsapp:logs:failed";
}
