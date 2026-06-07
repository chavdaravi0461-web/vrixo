import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";
import { createQueue, createWorker, getQueueHealth, getQueue } from "@/lib/queue";
import { publishEvent } from "@/lib/event-bus";

interface CronDefinition {
  name: string;
  schedule: string;
  description: string;
  handler: () => Promise<{ processed: number; failed: number }>;
  maxRetries: number;
  timeoutMs: number;
}

interface DeadLetterRecord {
  id: string;
  queueName: string;
  jobId: string;
  jobData: Record<string, unknown>;
  error: string;
  failedAt: string;
  retryCount: number;
  status: "pending_review" | "retrying" | "archived";
}

const DLQ_PREFIX = "dlq:records";
const CRON_STATE_PREFIX = "cron:state";
const WORKER_METRICS_PREFIX = "worker:metrics";

class WorkerFabric {
  private crons: CronDefinition[] = [];
  private cronTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  registerCron(cron: CronDefinition): void {
    this.crons.push(cron);
    logInfo("worker-fabric.cron_registered", { name: cron.name, schedule: cron.schedule });
  }

  async startCronEngine(intervalMs = 60_000): Promise<void> {
    if (this.cronTimer) return;
    this.running = true;

    logInfo("worker-fabric.cron_engine_started", { crons: this.crons.length, intervalMs });

    const runAll = async () => {
      for (const cron of this.crons) {
        await this.executeCronIfDue(cron);
      }
    };

    await runAll();
    this.cronTimer = setInterval(runAll, intervalMs);
  }

  stopCronEngine(): void {
    this.running = false;
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }

  private async executeCronIfDue(cron: CronDefinition): Promise<void> {
    const lockKey = `${CRON_STATE_PREFIX}:lock:${cron.name}`;
    const acquired = await withRedis(async (redis) => {
      const result = await redis.setnx(lockKey, Date.now().toString());
      if (result === 1) {
        await redis.expire(lockKey, Math.ceil(cron.timeoutMs / 1000) + 30);
        return true;
      }
      return false;
    }, false);

    if (!acquired) return;

    try {
      const lastRun = await withRedis(async (redis) => {
        return redis.get(`${CRON_STATE_PREFIX}:last:${cron.name}`);
      }, null as string | null);

      const now = Date.now();
      const intervalMs = this.parseSchedule(cron.schedule);
      if (lastRun && now - Number(lastRun) < intervalMs) return;

      logInfo("worker-fabric.cron_executing", { name: cron.name });

      const result = await this.executeWithTimeout(cron.handler, cron.timeoutMs);

      await withRedis(async (redis) => {
        await redis.setex(`${CRON_STATE_PREFIX}:last:${cron.name}`, 86400, now.toString());
        await redis.lpush(`${WORKER_METRICS_PREFIX}:${cron.name}`, JSON.stringify({
          ts: now,
          processed: result.processed,
          failed: result.failed,
          durationMs: result.processed + result.failed,
        }));
        await redis.ltrim(`${WORKER_METRICS_PREFIX}:${cron.name}`, 0, 99);
        return true;
      }, false);

      if (result.failed > 0) {
        logWarn("worker-fabric.cron_partial_failure", { name: cron.name, processed: result.processed, failed: result.failed });
      }
    } catch (error) {
      logError("worker-fabric.cron_failed", { name: cron.name, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await withRedis(async (redis) => {
        await redis.del(lockKey);
        return true;
      }, false);
    }
  }

  private async executeWithTimeout(
    handler: () => Promise<{ processed: number; failed: number }>,
    timeoutMs: number,
  ): Promise<{ processed: number; failed: number }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ processed: 0, failed: 1 });
      }, timeoutMs);

      handler()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve({ processed: 0, failed: 1 });
        });
    });
  }

  private parseSchedule(schedule: string): number {
    if (schedule.endsWith("s")) return Number(schedule.slice(0, -1)) * 1000;
    if (schedule.endsWith("m")) return Number(schedule.slice(0, -1)) * 60_000;
    if (schedule.endsWith("h")) return Number(schedule.slice(0, -1)) * 3600_000;
    if (schedule.endsWith("d")) return Number(schedule.slice(0, -1)) * 86400_000;
    return Number(schedule) * 1000;
  }

  async recordDeadLetter(
    queueName: string,
    jobId: string,
    jobData: Record<string, unknown>,
    error: string,
  ): Promise<void> {
    const record: DeadLetterRecord = {
      id: crypto.randomUUID(),
      queueName,
      jobId,
      jobData,
      error,
      failedAt: new Date().toISOString(),
      retryCount: 0,
      status: "pending_review",
    };

    await withRedis(async (redis) => {
      await redis.lpush(`${DLQ_PREFIX}:${queueName}`, JSON.stringify(record));
      await redis.ltrim(`${DLQ_PREFIX}:${queueName}`, 0, 999);
      await redis.lpush(DLQ_PREFIX, JSON.stringify(record));
      await redis.ltrim(DLQ_PREFIX, 0, 9999);
      return true;
    }, false);

    await publishEvent({
      type: "queue.failed",
      severity: "warn",
      entityId: jobId,
      entityType: "job",
      payload: { queueName, error: error.slice(0, 200), dlqId: record.id, traceId: getTraceId() },
    });
  }

  async retryDeadLetter(queueName: string, recordId: string): Promise<boolean> {
    return withRedis(async (redis) => {
      const records = await redis.lrange(`${DLQ_PREFIX}:${queueName}`, 0, -1);
      for (const raw of records) {
        const record = JSON.parse(raw) as DeadLetterRecord;
        if (record.id === recordId) {
          record.retryCount++;
          record.status = "retrying";
          const queue = getQueue(queueName);
          if (queue) {
            await queue.add(record.jobId, record.jobData, {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
            });
          }
          return true;
        }
      }
      return false;
    }, false);
  }

  async getDeadLetterRecords(queueName?: string): Promise<DeadLetterRecord[]> {
    if (queueName) {
      return withRedis(async (redis) => {
        const raw = await redis.lrange(`${DLQ_PREFIX}:${queueName}`, 0, -1);
        return raw.map((r) => JSON.parse(r) as DeadLetterRecord);
      }, [] as DeadLetterRecord[]);
    }

    return withRedis(async (redis) => {
      const raw = await redis.lrange(DLQ_PREFIX, 0, 99);
      return raw.map((r) => JSON.parse(r) as DeadLetterRecord);
    }, [] as DeadLetterRecord[]);
  }

  async getCronMetrics(cronName: string): Promise<Array<{ ts: number; processed: number; failed: number }>> {
    return withRedis(async (redis) => {
      const raw = await redis.lrange(`${WORKER_METRICS_PREFIX}:${cronName}`, 0, 99);
      return raw.map((r) => JSON.parse(r));
    }, []);
  }

  getWorkerMetrics() {
    const health = getQueueHealth("default");
    return {
      crons: this.crons.length,
      cronEngineRunning: this.running,
      ...health,
    };
  }
}

export const workerFabric = new WorkerFabric();

async function dispatchAbandonedCarts(): Promise<{ processed: number; failed: number }> {
  try {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: abandonedCarts } = await supabase
      .from("carts")
      .select("id, user_id")
      .eq("abandoned", true)
      .lt("updated_at", cutoff)
      .limit(500);

    if (!abandonedCarts || abandonedCarts.length === 0) return { processed: 0, failed: 0 };

    const queue = getQueue("abandoned-cart-recovery");
    if (queue) {
      for (const cart of abandonedCarts) {
        await queue.add(cart.id, { cartId: cart.id, userId: cart.user_id });
      }
    }

    await supabase
      .from("carts")
      .update({ recovered_scheduled: true })
      .in("id", abandonedCarts.map((c) => c.id));

    return { processed: abandonedCarts.length, failed: 0 };
  } catch {
    return { processed: 0, failed: 1 };
  }
}

async function recoverExpiredInventoryReservations(): Promise<{ processed: number; failed: number }> {
  try {
    const { inventoryGrid } = await import("@/services/inventory/inventory-grid");
    const recovered = await inventoryGrid.recoverExpiredReservations();
    return { processed: recovered, failed: 0 };
  } catch {
    return { processed: 0, failed: 1 };
  }
}

workerFabric.registerCron({
  name: "abandoned-carts",
  schedule: "15m",
  description: "Recovers abandoned carts and sends reminders",
  handler: dispatchAbandonedCarts,
  maxRetries: 3,
  timeoutMs: 30_000,
});

workerFabric.registerCron({
  name: "inventory-reservation-recovery",
  schedule: "5m",
  description: "Releases expired inventory reservations",
  handler: recoverExpiredInventoryReservations,
  maxRetries: 3,
  timeoutMs: 30_000,
});
