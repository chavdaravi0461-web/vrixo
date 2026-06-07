/**
 * P95 Tracker — measures response time percentiles for operation latency SLOs.
 *
 * Tracks min, max, p50, p95, p99 for named operations.
 * Periodically reports via structured log.
 *
 * Usage:
 *   const tracker = new P95Tracker("order-fetch");
 *   const stop = tracker.start();
 *   await fetchOrder();
 *   stop();
 */

type Bucket = {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
};

export class P95Tracker {
  private name: string;
  private buckets: Bucket[] = [];
  private currentBucket: Bucket = { count: 0, sum: 0, min: Infinity, max: 0, values: [] };
  private maxSamplesPerBucket: number;

  constructor(name: string, maxSamplesPerBucket = 1000) {
    this.name = name;
    this.maxSamplesPerBucket = maxSamplesPerBucket;
  }

  start(): () => void {
    const startedAt = performance.now();
    return () => {
      const duration = performance.now() - startedAt;
      this.record(duration);
    };
  }

  record(durationMs: number): void {
    if (this.currentBucket.values.length >= this.maxSamplesPerBucket) {
      this.buckets.push(this.currentBucket);
      if (this.buckets.length > 10) this.buckets.shift();
      this.currentBucket = { count: 0, sum: 0, min: Infinity, max: 0, values: [] };
    }

    const b = this.currentBucket;
    b.count++;
    b.sum += durationMs;
    if (durationMs < b.min) b.min = durationMs;
    if (durationMs > b.max) b.max = durationMs;
    b.values.push(durationMs);
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  snapshot(): {
    name: string;
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  } {
    const allValues = [...this.currentBucket.values];
    for (const b of this.buckets) {
      allValues.push(...b.values);
    }
    allValues.sort((a, b) => a - b);

    const count = allValues.length;
    const sum = this.currentBucket.sum + this.buckets.reduce((s, b) => s + b.sum, 0);

    return {
      name: this.name,
      count,
      avgMs: count > 0 ? sum / count : 0,
      minMs: allValues[0] ?? 0,
      maxMs: allValues[count - 1] ?? 0,
      p50Ms: this.percentile(allValues, 50),
      p95Ms: this.percentile(allValues, 95),
      p99Ms: this.percentile(allValues, 99),
    };
  }

  log(): void {
    const s = this.snapshot();
    if (s.count > 0) {
      console.log("[p95]", JSON.stringify({ ...s, ts: new Date().toISOString() }));
    }
  }
}

export const dbLatencyTracker = new P95Tracker("supabase-query");
export const redisLatencyTracker = new P95Tracker("redis-op");
export const whatsappLatencyTracker = new P95Tracker("whatsapp-api");
export const aiLatencyTracker = new P95Tracker("ai-api");
export const orderLatencyTracker = new P95Tracker("order-flow");
export const webhookLatencyTracker = new P95Tracker("webhook-process");

// Log P95 snapshots every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    dbLatencyTracker.log();
    redisLatencyTracker.log();
    whatsappLatencyTracker.log();
    aiLatencyTracker.log();
    orderLatencyTracker.log();
    webhookLatencyTracker.log();
  }, 60_000);
}
