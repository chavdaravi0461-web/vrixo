import { logInfo, logWarn, logError } from "@/lib/observability";

function validateRequiredEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ] as const;

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    logError("env.missing_required", { vars: missing });
    return false;
  }

  const critical: Array<{ key: string; label: string; or?: string }> = [
    { key: "RAZORPAY_KEY_ID", label: "Razorpay Payments" },
    { key: "RAZORPAY_KEY_SECRET", label: "Razorpay Secret" },
    { key: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay Webhooks" },
    { key: "WHATSAPP_CLOUD_API_TOKEN", label: "WhatsApp API", or: "WHATSAPP_ACCESS_TOKEN" },
    { key: "WHATSAPP_PHONE_NUMBER_ID", label: "WhatsApp Phone ID" },
    { key: "WHATSAPP_VERIFY_TOKEN", label: "WhatsApp Verify Token" }
  ];

  for (const item of critical) {
    const exists = Boolean(process.env[item.key]?.trim());
    const altExists = item.or ? Boolean(process.env[item.or]?.trim()) : false;
    if (!exists && !altExists) {
      logWarn("env.missing_critical", { var: item.key, service: item.label });
    }
  }

  return true;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const env = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;

    validateRequiredEnv();

    logInfo("app.startup", { env, vercelEnv });

    const { registerHealthCheck, createSimpleHealthCheck } = await import("@/lib/health-system");
    registerHealthCheck(createSimpleHealthCheck(
      "environment",
      true,
      async () => true,
      async () => ({
        nodeEnv: env,
        vercelEnv: vercelEnv || "none",
        hasSentry: Boolean(process.env.SENTRY_DSN),
        hasRedis: Boolean(process.env.REDIS_URL),
        hasRazorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
        hasWhatsApp: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN),
        hasGroq: Boolean(process.env.GROQ_API_KEY),
        hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
      })
    ));

    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
          environment: vercelEnv || env,
          release: process.env.VERCEL_GIT_COMMIT_SHA || undefined
        });
        logInfo("sentry.initialized", { dsn: process.env.SENTRY_DSN.slice(0, 20) + "..." });
      } catch (error) {
        logWarn("sentry.init_failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (process.env.AUTO_HEALING_ENABLED === "true" || env === "production") {
      const intervalMs = Number(process.env.HEALING_INTERVAL_MS || 300_000);
      logInfo("healing.auto_engine_activated", { intervalMs });
      const { healingEngine } = await import("@/services/healing/healing-engine");
      setInterval(() => {
        healingEngine.runHealingCycle().catch((err) => {
          logError("healing.auto_cycle_failed", { error: err instanceof Error ? err.message : String(err) });
        });
      }, intervalMs);
      healingEngine.runHealingCycle().catch(() => undefined);
    }

    if (process.env.CHAOS_ENGINE_ENABLED === "true" || (env === "production" && process.env.CHAOS_ENGINE_ENABLED !== "false")) {
      const chaosInterval = Number(process.env.CHAOS_ENGINE_INTERVAL_MS || 600_000);
      const { chaosEngine } = await import("@/lib/chaos-engineering");
      chaosEngine.start(chaosInterval).catch((err) => {
        logWarn("chaos.auto_start_failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }

    if (env === "production" || process.env.PERFORMANCE_INTELLIGENCE_ENABLED === "true") {
      const { startPerformanceIntelligence } = await import("@/lib/performance-intelligence");
      startPerformanceIntelligence().catch((err) => {
        logWarn("perf.auto_start_failed", { error: err instanceof Error ? err.message : String(err) });
      });
    }

    if (process.env.START_WORKER === "true" || env === "production") {
      try {
        const { startWhatsAppWorker } = await import("@/services/workers/whatsapp-worker");
        startWhatsAppWorker();
        logInfo("worker.whatsapp.started");
      } catch (error) {
        logWarn("worker.whatsapp.init_failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) {
    console.error("[MIDDLEWARE_ERROR]", error, error instanceof Error ? error.stack : "");
  }
}
