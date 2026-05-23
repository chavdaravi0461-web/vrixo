import { Queue, Worker, Job, type JobsOptions } from "bullmq";
import { getRedis } from "@/lib/redis";
import { publishEvent } from "@/lib/event-bus";

export const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "vrixo";

const queues = new Map<string, Queue>();

export function createQueue(name: string) {
  const queueName = `${QUEUE_PREFIX}:${name}`;
  return {
    add(dataName: string, data: unknown, opts?: JobsOptions) {
      const queue = getQueue(queueName);
      return queue.add(dataName, data, opts);
    },
    get name() {
      return queueName;
    }
  };
}

export function createWorker<T = unknown>(name: string, processor: (job: Job<T>) => Promise<unknown>) {
  const queueName = `${QUEUE_PREFIX}:${name}`;
  const connection = getRedis();
  const worker = new Worker<T>(queueName, async (job) => processor(job), { connection, concurrency: 4 });
  worker.on("failed", (job, err) => {
    console.error("[worker.failed]", queueName, job.id, err?.message ?? err);
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
    console.info("[worker.completed]", queueName, job.id);
  });
  return worker;
}

export type QueueJob<T = unknown> = {
  name: string;
  data: T;
  opts?: JobsOptions;
};

function getQueue(queueName: string) {
  const existing = queues.get(queueName);
  if (existing) return existing;
  const queue = new Queue(queueName, { connection: getRedis() });
  queues.set(queueName, queue);
  return queue;
}
