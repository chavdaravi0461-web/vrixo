import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn } from "@/lib/observability";

interface AdaptiveThresholds {
  blockScore: number;
  reviewScore: number;
  highOrderAmount: number;
  extremeOrderAmount: number;
  ipVelocityWarn: number;
  ipVelocityBlock: number;
  deviceReuseThreshold: number;
  bulkOrderThreshold: number;
  codAbuseCount: number;
}

const DEFAULT_THRESHOLDS: AdaptiveThresholds = {
  blockScore: 85,
  reviewScore: 60,
  highOrderAmount: 5000,
  extremeOrderAmount: 20000,
  ipVelocityWarn: 3,
  ipVelocityBlock: 10,
  deviceReuseThreshold: 5,
  bulkOrderThreshold: 10,
  codAbuseCount: 3,
};

const THRESHOLD_KEY = "fraud:adaptive:thresholds";
const STATS_KEY = "fraud:adaptive:stats";
const LEARNING_RATE = 0.05;
const MIN_SAMPLES = 100;
const ADAPT_INTERVAL = 3600_000;

let cachedThresholds: AdaptiveThresholds | null = null;
let lastAdaptTime = 0;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export async function getAdaptiveThresholds(): Promise<AdaptiveThresholds> {
  if (cachedThresholds && Date.now() - lastAdaptTime < ADAPT_INTERVAL) {
    return cachedThresholds;
  }

  const stored = await withRedis(async (redis) => {
    const raw = await redis.get(THRESHOLD_KEY);
    return raw ? (JSON.parse(raw) as AdaptiveThresholds) : null;
  }, null as AdaptiveThresholds | null);

  cachedThresholds = stored ?? { ...DEFAULT_THRESHOLDS };
  lastAdaptTime = Date.now();
  return cachedThresholds!;
}

export async function recordFraudOutcome(
  score: number,
  action: "allow" | "review" | "block",
  actualOutcome: "legitimate" | "fraudulent" | "unknown",
): Promise<void> {
  const statsKey = `${STATS_KEY}:rolling`;
  await withRedis(async (redis) => {
    await redis.lpush(statsKey, JSON.stringify({ score, action, actualOutcome, ts: Date.now() }));
    await redis.ltrim(statsKey, 0, 999);
    await redis.expire(statsKey, 86400 * 30);
    return true;
  }, false);
}

async function computeRollingStats(): Promise<{
  falsePositives: number;
  falseNegatives: number;
  avgScoreLegit: number;
  avgScoreFraud: number;
  sampleCount: number;
}> {
  const records = await withRedis(async (redis) => {
    const raw = await redis.lrange(`${STATS_KEY}:rolling`, 0, 999);
    return raw.map((r) => JSON.parse(r) as { score: number; action: string; actualOutcome: string; ts: number });
  }, [] as Array<{ score: number; action: string; actualOutcome: string; ts: number }>);

  if (records.length < MIN_SAMPLES) {
    return { falsePositives: 0, falseNegatives: 0, avgScoreLegit: 0, avgScoreFraud: 0, sampleCount: records.length };
  }

  let fp = 0;
  let fn = 0;
  let legitTotal = 0;
  let legitCount = 0;
  let fraudTotal = 0;
  let fraudCount = 0;

  for (const r of records) {
    if (r.actualOutcome === "legitimate") {
      legitTotal += r.score;
      legitCount++;
      if (r.action === "block") fp++;
    } else if (r.actualOutcome === "fraudulent") {
      fraudTotal += r.score;
      fraudCount++;
      if (r.action === "allow") fn++;
    }
  }

  return {
    falsePositives: fp,
    falseNegatives: fn,
    avgScoreLegit: legitCount > 0 ? legitTotal / legitCount : 0,
    avgScoreFraud: fraudCount > 0 ? fraudTotal / fraudCount : 0,
    sampleCount: records.length,
  };
}

export async function adaptThresholds(): Promise<AdaptiveThresholds> {
  const stats = await computeRollingStats();
  if (stats.sampleCount < MIN_SAMPLES) {
    cachedThresholds = { ...DEFAULT_THRESHOLDS };
    lastAdaptTime = Date.now();
    return cachedThresholds;
  }

  const current = await getAdaptiveThresholds();
  const thresholds = { ...current };

  const legitMargin = stats.avgScoreFraud - stats.avgScoreLegit;
  const fpRatio = stats.falsePositives / Math.max(stats.sampleCount, 1);

  if (fpRatio > 0.1) {
    thresholds.blockScore = clamp(thresholds.blockScore + 5, 70, 100);
    thresholds.reviewScore = clamp(thresholds.reviewScore + 3, 50, 95);
  } else if (fpRatio < 0.02 && stats.falseNegatives > 0) {
    thresholds.blockScore = clamp(thresholds.blockScore - 3, 70, 100);
    thresholds.reviewScore = clamp(thresholds.reviewScore - 2, 50, 95);
  }

  if (legitMargin < 20 && legitMargin > 0) {
    thresholds.highOrderAmount = clamp(thresholds.highOrderAmount * 0.9, 1000, 50000);
    thresholds.extremeOrderAmount = clamp(thresholds.extremeOrderAmount * 0.9, 5000, 200000);
  }

  if (stats.falseNegatives > stats.falsePositives) {
    thresholds.ipVelocityWarn = clamp(thresholds.ipVelocityWarn - 1, 1, 20);
    thresholds.ipVelocityBlock = clamp(thresholds.ipVelocityBlock - 2, 3, 50);
  }

  await withRedis(async (redis) => {
    await redis.setex(THRESHOLD_KEY, 86400 * 30, JSON.stringify(thresholds));
    return true;
  }, false);

  cachedThresholds = thresholds;
  lastAdaptTime = Date.now();

  logInfo("fraud.thresholds_adapted", {
    blockScore: thresholds.blockScore,
    reviewScore: thresholds.reviewScore,
    fpRatio: fpRatio.toFixed(3),
    fnCount: stats.falseNegatives,
    legitMargin: legitMargin.toFixed(1),
    sampleCount: stats.sampleCount,
  });

  return thresholds;
}

export async function getAdaptiveFraudStats() {
  const stats = await computeRollingStats();
  const thresholds = await getAdaptiveThresholds();
  return {
    thresholds,
    rollingStats: stats,
    lastAdaptTime: lastAdaptTime ? new Date(lastAdaptTime).toISOString() : null,
    isAdapting: stats.sampleCount >= MIN_SAMPLES,
    defaults: stats.sampleCount < MIN_SAMPLES,
  };
}
