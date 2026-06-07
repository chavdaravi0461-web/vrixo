import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingNotifications } from "@/lib/notification-queue";
import { logError, logInfo } from "@/lib/observability";

type OutboxWorker = {
  stop: () => Promise<void>;
};

export function startNotificationOutboxWorker(): OutboxWorker {
  const pollIntervalMs = Math.max(
    500,
    Number(process.env.NOTIFICATION_POLL_INTERVAL_MS ?? 2000)
  );
  const batchSize = Math.min(
    100,
    Math.max(1, Number(process.env.NOTIFICATION_BATCH_SIZE ?? 25))
  );

  let stopped = false;
  let activeRun: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(run, delay);
  };

  const run = () => {
    if (stopped || activeRun) return;
    activeRun = processPendingNotifications(createAdminClient(), batchSize)
      .then((results) => {
        if (results.length > 0) {
          logInfo("notification_outbox.batch_processed", {
            processed: results.length,
            sent: results.filter((item) => item.result.sent).length
          });
        }
      })
      .catch((error) => {
        logError("notification_outbox.batch_failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        activeRun = null;
        schedule(pollIntervalMs);
      });
  };

  logInfo("notification_outbox.started", { pollIntervalMs, batchSize });
  schedule(0);

  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (activeRun) await activeRun;
      logInfo("notification_outbox.stopped");
    }
  };
}
