import "server-only";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn } from "@/lib/observability";

interface HistogramBucket {
  label: string;
  minMs: number;
  maxMs: number;
  count: number;
}

interface PerformanceSnapshot {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  avg: number;
  min: number;
  max: number;
  totalSamples: number;
  timestamp: string;
}

interface RouteMetrics {
  route: string;
  method: string;
  samples: number[];
  lastSnapshot: PerformanceSnapshot | null;
}

const HISTOGRAM_BUCKETS: HistogramBucket[] = [
  { label: "0-5ms", minMs: 0, maxMs: 5, count: 0 },
  { label: "5-10ms", minMs: 5, maxMs: 10, count: 0 },
  { label: "10-25ms", minMs: 10, maxMs: 25, count: 0 },
  { label: "25-50ms", minMs: 25, maxMs: 50, count: 0 },
  { label: "50-100ms", minMs: 50, maxMs: 100, count: 0 },
  { label: "100-200ms", minMs: 100, maxMs: 200, count: 0 },
  { label: "200-500ms", minMs: 200, maxMs: 500, count: 0 },
  { label: "500-1000ms", minMs: 500, maxMs: 1000, count: 0 },
  { label: "1-2s", minMs: 1000, maxMs: 2000, count: 0 },
  { label: "2-5s", minMs: 2000, maxMs: 5000, count: 0 },
  { label: "5-10s", minMs: 5000, maxMs: 10000, count: 0 },
  { label: "10s+", minMs: 10000, maxMs: Infinity, count: 0 },
];

const ROUTE_METRICS = new Map<string, RouteMetrics>();
const SNAPSHOT_INTERVAL_MS = 60_000;
const MAX_SAMPLES_PER_ROUTE = 10_000;
const REDIS_PREFIX = "perf:snapshot:";

let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let totalSamplesRecorded = 0;

function getOrCreateRoute(route: string, method: string): RouteMetrics {
  const key = `${method}:${route}`;
  let metrics = ROUTE_METRICS.get(key);
  if (!metrics) {
    metrics = { route, method, samples: [], lastSnapshot: null };
    ROUTE_METRICS.set(key, metrics);
  }
  return metrics;
}

export function recordLatency(route: string, method: string, durationMs: number): void {
  const metrics = getOrCreateRoute(route, method);
  metrics.samples.push(durationMs);
  totalSamplesRecorded++;

  if (metrics.samples.length > MAX_SAMPLES_PER_ROUTE) {
    metrics.samples.splice(0, metrics.samples.length - MAX_SAMPLES_PER_ROUTE);
  }
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function computeSnapshot(metrics: RouteMetrics): PerformanceSnapshot {
  const sorted = [...metrics.samples].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);

  const snapshot: PerformanceSnapshot = {
    p50: calculatePercentile(sorted, 50),
    p75: calculatePercentile(sorted, 75),
    p90: calculatePercentile(sorted, 90),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    p999: calculatePercentile(sorted, 99.9),
    avg: sorted.length > 0 ? sum / sorted.length : 0,
    min: sorted.length > 0 ? sorted[0] : 0,
    max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    totalSamples: sorted.length,
    timestamp: new Date().toISOString(),
  };

  metrics.lastSnapshot = snapshot;
  return snapshot;
}

function computeRouteHistogram(samples: number[]): HistogramBucket[] {
  const buckets = HISTOGRAM_BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const s of samples) {
    for (const bucket of buckets) {
      if (s >= bucket.minMs && s < bucket.maxMs) {
        bucket.count++;
        break;
      }
    }
  }
  return buckets;
}

export function getRouteMetrics(route?: string, method?: string) {
  if (route && method) {
    const key = `${method}:${route}`;
    const metrics = ROUTE_METRICS.get(key);
    if (!metrics) return null;
    const snapshot = computeSnapshot(metrics);
    const histogram = computeRouteHistogram(metrics.samples);
    return { route, method, snapshot, histogram, activeSamples: metrics.samples.length };
  }

  const all: Array<{
    route: string;
    method: string;
    snapshot: PerformanceSnapshot;
    histogram: HistogramBucket[];
    activeSamples: number;
  }> = [];

  for (const [, metrics] of ROUTE_METRICS) {
    const snapshot = computeSnapshot(metrics);
    const histogram = computeRouteHistogram(metrics.samples);
    all.push({ route: metrics.route, method: metrics.method, snapshot, histogram, activeSamples: metrics.samples.length });
  }

  return all.sort((a, b) => b.snapshot.p99 - a.snapshot.p99);
}

export async function startPerformanceIntelligence(intervalMs = SNAPSHOT_INTERVAL_MS): Promise<void> {
  if (snapshotTimer) return;

  logInfo("perf.intelligence_started", { intervalMs, maxRoutes: ROUTE_METRICS.size });

  snapshotTimer = setInterval(async () => {
    await takeAndPersistSnapshot();
  }, intervalMs);
}

export function stopPerformanceIntelligence(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}

export async function takeAndPersistSnapshot(): Promise<void> {
  for (const [key, metrics] of ROUTE_METRICS) {
    if (metrics.samples.length === 0) continue;
    const snapshot = computeSnapshot(metrics);

    await withRedis(async (redis) => {
      const redisKey = `${REDIS_PREFIX}${key}`;
      await redis.lpush(redisKey, JSON.stringify(snapshot));
      await redis.ltrim(redisKey, 0, 479);
      await redis.expire(redisKey, 86400);
      return true;
    }, false);
  }
}

export async function getHistoricalSnapshots(route: string, method: string, limit = 60) {
  const key = `${method}:${route}`;
  const redisKey = `${REDIS_PREFIX}${key}`;

  return withRedis(async (redis) => {
    const raw = await redis.lrange(redisKey, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as PerformanceSnapshot);
  }, [] as PerformanceSnapshot[]);
}

export function getPerformanceStats() {
  return {
    activeRoutes: ROUTE_METRICS.size,
    totalSamples: totalSamplesRecorded,
    snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
    isRunning: snapshotTimer !== null,
    routes: getRouteMetrics(),
  };
}
