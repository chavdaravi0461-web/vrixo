import { startWhatsAppWorker } from "@/services/workers/whatsapp-worker";
import { getQueueHealth } from "@/lib/queue";
import { startNotificationOutboxWorker } from "@/services/workers/notification-outbox-worker";

let outboxWorker: ReturnType<typeof startNotificationOutboxWorker> | null = null;

process.on("unhandledRejection", (reason) => {
  console.error("[whatsapp-worker] unhandledRejection", reason);
  try {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(reason, { level: "fatal" });
    }).catch(() => undefined);
  } catch {
    // non-blocking
  }
});

process.on("uncaughtException", (error) => {
  console.error("[whatsapp-worker] uncaughtException", error);
  try {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error, { level: "fatal" });
      Sentry.close(2000).finally(() => process.exit(1));
    }).catch(() => process.exit(1));
  } catch {
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.info("[whatsapp-worker] SIGTERM received, shutting down");
  await outboxWorker?.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.info("[whatsapp-worker] SIGINT received, shutting down");
  await outboxWorker?.stop();
  process.exit(0);
});

async function main() {
  if (process.argv.includes("--health")) {
    const health = await getQueueHealth("whatsapp-jobs");
    console.info(JSON.stringify({ ok: true, ...health }, null, 2));
    return;
  }

  startWhatsAppWorker();
  outboxWorker = startNotificationOutboxWorker();
}

main().catch((error) => {
  console.error("[whatsapp-worker] startup failed", error);
  process.exit(1);
});
