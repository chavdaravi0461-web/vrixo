type LogLevel = "info" | "warn" | "error" | "fatal";
type LogContext = Record<string, unknown>;

const SECRET_KEYS = ["token", "secret", "password", "authorization", "key"];

export function createRequestId(prefix = "vx") {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

export function logger(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    ...sanitizeContext(context),
    ts: new Date().toISOString()
  };
  const line = JSON.stringify(payload);

  if (level === "error" || level === "fatal") {
    console.error("[vrixo]", line);
    return;
  }

  if (level === "warn") {
    console.warn("[vrixo]", line);
    return;
  }

  console.info("[vrixo]", line);
}

export function logLatency(message: string, startedAt: number, context: LogContext = {}) {
  logger("info", message, {
    ...context,
    durationMs: Math.round(performance.now() - startedAt)
  });
}

export async function measure<T>(
  message: string,
  task: () => Promise<T>,
  context: LogContext = {}
) {
  const startedAt = performance.now();
  try {
    const result = await task();
    logLatency(message, startedAt, context);
    return result;
  } catch (error) {
    logger("error", `${message}.failed`, {
      ...context,
      durationMs: Math.round(performance.now() - startedAt),
      error: errorToString(error)
    });
    throw error;
  }
}

export function errorToString(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sanitizeContext(context: LogContext) {
  const output: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    const lower = key.toLowerCase();
    if (SECRET_KEYS.some((secret) => lower.includes(secret))) {
      output[key] = "[redacted]";
      continue;
    }

    if (lower.includes("phone") && typeof value === "string") {
      output[key] = maskPhone(value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "***";
}
