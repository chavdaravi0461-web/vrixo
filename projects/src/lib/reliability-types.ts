export type ReliabilityStatus = "healthy" | "degraded" | "unhealthy";

export type DependencyState = {
  name: string;
  status: ReliabilityStatus;
  lastFailureAt: number | null;
  failureCount: number;
  degradedMode: boolean;
};

export type SafeResponse<T = unknown> = {
  success: boolean;
  data: T | null;
  error: string | null;
  requestId: string | null;
  degraded: boolean;
  dependencies: DependencyState[];
};

export function safeSuccess<T>(data: T, overrides?: Partial<SafeResponse<T>>): SafeResponse<T> {
  return {
    success: true,
    data,
    error: null,
    requestId: overrides?.requestId ?? null,
    degraded: overrides?.degraded ?? false,
    dependencies: overrides?.dependencies ?? [],
  };
}

export function safeError<T = null>(error: string, overrides?: Partial<SafeResponse<T>>): SafeResponse<T> {
  return {
    success: false,
    data: null,
    error,
    requestId: overrides?.requestId ?? null,
    degraded: overrides?.degraded ?? true,
    dependencies: overrides?.dependencies ?? [],
  };
}

export function classifyError(err: unknown): { message: string; type: "timeout" | "network" | "dependency" | "validation" | "internal" | "unknown"; recoverable: boolean } {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) return { message: err.message, type: "timeout", recoverable: true };
    if (msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("fetch failed") || msg.includes("network")) return { message: err.message, type: "network", recoverable: true };
    if (msg.includes("supabase") || msg.includes("redis") || msg.includes("whatsapp") || msg.includes("groq") || msg.includes("razorpay")) return { message: err.message, type: "dependency", recoverable: true };
    if (msg.includes("validation") || msg.includes("invalid") || msg.includes("required")) return { message: err.message, type: "validation", recoverable: false };
    return { message: err.message, type: "internal", recoverable: false };
  }
  return { message: String(err), type: "unknown", recoverable: false };
}
