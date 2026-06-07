/**
 * Failure metrics — counts failures by category for observability.
 *
 * Exposes structured counters that can be read by health endpoints,
 * logged periodically, or exposed to monitoring systems.
 *
 * Usage:
 *   recordFailure("supabase", "timeout");
 *   recordFailure("whatsapp", "rate_limited");
 *   const report = getFailureReport();
 */

type FailureCategory = "supabase" | "redis" | "whatsapp" | "ai" | "payment" | "webhook" | "auth" | "queue" | "event-bus" | "cache" | "validation" | "internal";

type FailureRecord = {
  count: number;
  firstAt: number;
  lastAt: number;
};

const failures = new Map<string, FailureRecord>();
const MAX_FAILURE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function recordFailure(category: FailureCategory, reason: string): void {
  const key = `${category}:${reason}`;
  const now = Date.now();
  const existing = failures.get(key);

  if (existing) {
    existing.count++;
    existing.lastAt = now;
  } else {
    failures.set(key, { count: 1, firstAt: now, lastAt: now });
  }
}

export function getFailureReport(): Array<{
  category: string;
  reason: string;
  count: number;
  firstAt: string;
  lastAt: string;
}> {
  cleanup();
  const report: Array<{
    category: string;
    reason: string;
    count: number;
    firstAt: string;
    lastAt: string;
  }> = [];

  for (const [key, record] of failures) {
    const [category, ...rest] = key.split(":");
    report.push({
      category,
      reason: rest.join(":"),
      count: record.count,
      firstAt: new Date(record.firstAt).toISOString(),
      lastAt: new Date(record.lastAt).toISOString(),
    });
  }

  report.sort((a, b) => b.count - a.count);
  return report;
}

export function getFailureCount(category: FailureCategory): number {
  let total = 0;
  for (const [key, record] of failures) {
    if (key.startsWith(category)) {
      total += record.count;
    }
  }
  return total;
}

export function getTotalFailureCount(): number {
  let total = 0;
  for (const record of failures.values()) {
    total += record.count;
  }
  return total;
}

function cleanup(): void {
  const cutoff = Date.now() - MAX_FAILURE_AGE_MS;
  for (const [key, record] of failures) {
    if (record.lastAt < cutoff) {
      failures.delete(key);
    }
  }
}

// Log failure report every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const report = getFailureReport();
    if (report.length > 0) {
      console.log("[failure-metrics]", JSON.stringify({ failures: report, ts: new Date().toISOString() }));
    }
  }, 300_000);
}
