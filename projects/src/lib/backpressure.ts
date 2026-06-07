/**
 * Backpressure — detects system overload and triggers load shedding.
 *
 * Monitors:
 * - Event bus buffer depth
 * - Queue depth
 * - Concurrency guard utilization
 * - Memory pressure
 *
 * When thresholds are exceeded:
 * - Logs structured warnings for observability
 * - Can be read by middleware/load balancers to shed load
 * - Triggers degraded mode indicators
 */

export type BackpressureLevel = "none" | "light" | "moderate" | "critical";

export type BackpressureReport = {
  level: BackpressureLevel;
  reasons: string[];
  eventBufferDepth: number;
  queueDepth: number;
  concurrencyUtilization: Record<string, number>;
  memoryUsageMb: number;
  highMemory: boolean;
};

let eventBufferDepth = 0;
let queueDepth = 0;
const concurrencyUtilization: Record<string, number> = {};
let lastReport: BackpressureReport | null = null;

export function reportEventBufferDepth(depth: number): void {
  eventBufferDepth = depth;
}

export function reportQueueDepth(depth: number): void {
  queueDepth = depth;
}

export function reportConcurrency(name: string, active: number, max: number): void {
  concurrencyUtilization[name] = max > 0 ? active / max : 0;
}

export function getConcurrencyUtilization(): Record<string, number> {
  return { ...concurrencyUtilization };
}

const HIGH_BUFFER_THRESHOLD = 200;
const CRITICAL_BUFFER_THRESHOLD = 400;
const HIGH_QUEUE_THRESHOLD = 50;
const CRITICAL_QUEUE_THRESHOLD = 200;
const HIGH_CONCURRENCY_THRESHOLD = 0.8;
const CRITICAL_CONCURRENCY_THRESHOLD = 0.95;
const HIGH_MEMORY_MB = 512;
const CRITICAL_MEMORY_MB = 768;

function getMemoryUsageMb(): number {
  try {
    if (typeof process !== "undefined" && "memoryUsage" in process) {
      return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
    return 0;
  } catch {
    return 0;
  }
}

export function assessBackpressure(): BackpressureReport {
  const reasons: string[] = [];
  const memMb = getMemoryUsageMb();
  const highMemory = memMb > HIGH_MEMORY_MB;

  if (eventBufferDepth >= CRITICAL_BUFFER_THRESHOLD) {
    reasons.push(`event_buffer_critical:${eventBufferDepth}`);
  } else if (eventBufferDepth >= HIGH_BUFFER_THRESHOLD) {
    reasons.push(`event_buffer_high:${eventBufferDepth}`);
  }

  if (queueDepth >= CRITICAL_QUEUE_THRESHOLD) {
    reasons.push(`queue_critical:${queueDepth}`);
  } else if (queueDepth >= HIGH_QUEUE_THRESHOLD) {
    reasons.push(`queue_high:${queueDepth}`);
  }

  for (const [name, ratio] of Object.entries(concurrencyUtilization)) {
    if (ratio >= CRITICAL_CONCURRENCY_THRESHOLD) {
      reasons.push(`concurrency_critical:${name}:${Math.round(ratio * 100)}%`);
    } else if (ratio >= HIGH_CONCURRENCY_THRESHOLD) {
      reasons.push(`concurrency_high:${name}:${Math.round(ratio * 100)}%`);
    }
  }

  if (memMb >= CRITICAL_MEMORY_MB) {
    reasons.push(`memory_critical:${memMb}mb`);
  } else if (memMb >= HIGH_MEMORY_MB) {
    reasons.push(`memory_high:${memMb}mb`);
  }

  let level: BackpressureLevel = "none";
  if (reasons.some((r) => r.includes("critical"))) {
    level = "critical";
  } else if (reasons.length >= 2) {
    level = "moderate";
  } else if (reasons.length >= 1) {
    level = "light";
  }

  const report: BackpressureReport = {
    level,
    reasons,
    eventBufferDepth,
    queueDepth,
    concurrencyUtilization: { ...concurrencyUtilization },
    memoryUsageMb: memMb,
    highMemory,
  };

  if (level !== "none" && (!lastReport || lastReport.level !== level)) {
    console.warn("[backpressure]", JSON.stringify({ ...report, ts: new Date().toISOString() }));
  }

  lastReport = report;
  return report;
}

export function isOverloaded(): boolean {
  const r = assessBackpressure();
  return r.level === "critical";
}

export function getBackpressureLevel(): BackpressureLevel {
  return assessBackpressure().level;
}
