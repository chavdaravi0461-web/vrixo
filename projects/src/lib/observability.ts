type ObservabilityContext = Record<string, unknown>;

let requestIdCounter = 0;

export function generateRequestId(): string {
  requestIdCounter += 1;
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 8);
  return `vx-${ts}-${rand}-${requestIdCounter}`;
}

export function captureAppError(error: unknown, context: ObservabilityContext = {}) {
  const safe = serializeError(error);
  const payload = { ...context, error: safe, ts: new Date().toISOString() };

  console.error("[vrixo.error]", JSON.stringify(payload));

  if (process.env.SENTRY_DSN) {
    try {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error, { extra: { ...context, requestId: context.requestId } });
      }).catch(() => undefined);
    } catch {
      // non-blocking
    }
  }
}

export function logInfo(message: string, context: ObservabilityContext = {}) {
  console.info("[vrixo.info]", JSON.stringify({ message, ...context, ts: new Date().toISOString() }));
}

export function logWarn(message: string, context: ObservabilityContext = {}) {
  console.warn("[vrixo.warn]", JSON.stringify({ message, ...context, ts: new Date().toISOString() }));
}

export function logError(message: string, context: ObservabilityContext = {}) {
  console.error("[vrixo.error]", JSON.stringify({ message, ...context, ts: new Date().toISOString() }));
}

export function logFatal(message: string, context: ObservabilityContext = {}) {
  console.error("[vrixo.fatal]", JSON.stringify({ message, ...context, ts: new Date().toISOString() }));
  captureAppError(new Error(message), context);
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
    captureAppError(error, { name, durationMs: Math.round(performance.now() - startedAt), ...context });
    throw error;
  }
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack.split('\n').slice(0, 4).join('\n')}` : ''}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
