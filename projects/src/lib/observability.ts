type ObservabilityContext = Record<string, unknown>;

export async function captureAppError(error: unknown, context: ObservabilityContext = {}) {
  console.error("[vrixo.error]", JSON.stringify({ ...context, error: error instanceof Error ? error.message : String(error) }));

  if (!process.env.SENTRY_DSN) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    // keep observability non-blocking
  }
}

export function logInfo(message: string, context: ObservabilityContext = {}) {
  console.info("[vrixo.info]", JSON.stringify({ message, ...context, ts: new Date().toISOString() }));
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  context: ObservabilityContext = {}
) {
  const startedAt = performance.now();
  try {
    const result = await fn();
    logInfo("metric.latency", { name, durationMs: Math.round(performance.now() - startedAt), ...context });
    return result;
  } catch (error) {
    await captureAppError(error, { name, durationMs: Math.round(performance.now() - startedAt), ...context });
    throw error;
  }
}

