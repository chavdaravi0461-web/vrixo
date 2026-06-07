import { Queue, Worker, Job, type JobsOptions } from "bullmq";
import { getRedis, isRedisAvailable } from "@/lib/redis";
import { publishEvent } from "@/lib/event-bus";
import { withTimeout } from "@/lib/request-timeout";
import { logger } from "@/lib/logger";
import { createCircuitBreaker } from "@/lib/circuit-breaker";
import { registerHealthCheck, createSimpleHealthCheck } from "@/lib/health-system";

const queueCircuit = createCircuitBreaker("bullmq-queue", {
  failureThreshold: 3,
  cooldownMs: 10_000,
  name: "bullmq-queue",
});

export const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "vrixo";

export const queues = new Map<string, Queue>();

registerHealthCheck(createSimpleHealthCheck(
  "bullmq-queues",
  false,
  async () => {
    if (!isRedisAvailable()) return true;
    try {
      const queue = getQueue(`${QUEUE_PREFIX}:health`);
      await queue.getWaitingCount();
      return true;
    } catch {
      return false;
    }
  },
  async () => ({
    queueCount: queues.size,
    circuitState: queueCircuit.getState(),
  })
));

export function createQueue(name: string) {
  const queueName = `${QUEUE_PREFIX}:${name}`;
  if (!isRedisAvailable()) {
    const noop = {
      async add(_dataName: string, _data: unknown, _opts?: JobsOptions) {
        return void 0;
      },
      get name() {
        return queueName;
      }
    };
    return noop;
  }
  return {
    async add(dataName: string, data: unknown, opts?: JobsOptions) {
      return queueCircuit.call(
        async () => {
          const queue = getQueue(queueName);
          return withTimeout(
            queue.add(dataName, data, opts),
            Number(process.env.QUEUE_ADD_TIMEOUT_MS ?? 1200),
            `Queue add timed out for ${queueName}`
          );
        },
        async () => {
          logger("warn", "queue.circuit_fallback", { queueName, operation: "add" });
          return void 0;
        }
      );
    },
    get name() {
      return queueName;
    }
  };
}

export function createWorker<T = unknown>(
  name: string,
  _processor: (job: Job<T>) => Promise<unknown>,
  options: { concurrency?: number; lockDuration?: number; stalledInterval?: number } = {}
) {
  const queueName = `${QUEUE_PREFIX}:${name}`;
  if (!isRedisAvailable()) {
    logger("info", "queue.worker_skipped", { queueName, reason: "redis_unavailable" });
    return null;
  }

  const connection = getRedis()!;
  const deadLetterQueue = getQueue(`${queueName}:dead-letter`);
  const worker = new Worker<T>(queueName, async (job) => _processor(job), {
    connection,
    concurrency: options.concurrency ?? Number(process.env.WHATSAPP_WORKER_CONCURRENCY ?? 6),
    lockDuration: options.lockDuration ?? 60_000,
    stalledInterval: options.stalledInterval ?? 30_000,
    maxStalledCount: 2
  });
  worker.on("failed", (job, err) => {
    const attempts = Number(job?.opts?.attempts ?? 1);
    const attemptsMade = Number(job?.attemptsMade ?? 0);
    logger("error", "queue.job_failed", {
      queueName,
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade,
      attempts,
      error: err?.message ?? String(err)
    });

    if (job && attemptsMade >= attempts) {
      deadLetterQueue.add(job.name, {
        originalQueue: queueName,
        originalJobId: job.id,
        attemptsMade,
        failedAt: new Date().toISOString(),
        error: err?.message ?? String(err),
        data: job.data
      }, {
        removeOnComplete: 1000,
        removeOnFail: 1000
      }).catch((error) => {
        logger("error", "queue.dead_letter_enqueue_failed", {
          queueName,
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

    void publishEvent({
      type: "queue.failed",
      severity: "critical",
      entityId: job?.id,
      entityType: queueName,
      payload: {
        queueName,
        jobName: job?.name,
        error: err?.message ?? String(err)
      }
    });
  });
  worker.on("completed", (job) => {
    logger("info", "queue.job_completed", {
      queueName,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade
    });
  });
  worker.on("stalled", (jobId) => logger("warn", "queue.job_stalled", { queueName, jobId }));
  worker.on("error", (error) => logger("error", "queue.worker_error", { queueName, error: error.message }));
  logger("info", "queue.worker_initialized", { queueName });
  return worker;
}

export type QueueJob<T = unknown> = {
  name: string;
  data: T;
  opts?: JobsOptions;
};

export function getQueue(queueName: string) {
  const existing = queues.get(queueName);
  if (existing) return existing;
  const redis = getRedis();
  if (!redis) throw new Error(`Redis unavailable — cannot create queue ${queueName}`);
  const queue = new Queue(queueName, { connection: redis });
  queues.set(queueName, queue);
  return queue;
}

export async function getQueueHealth(name: string) {
  const queueName = `${QUEUE_PREFIX}:${name}`;
  if (!isRedisAvailable()) {
    return { queueName, waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 };
  }
  const queue = getQueue(queueName);
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getCompletedCount(),
    queue.getFailedCount()
  ]);

  return { queueName, waiting, active, delayed, completed, failed };
}
