import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";

interface GMVMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueToday: number;
  ordersToday: number;
  revenueThisWeek: number;
  ordersThisWeek: number;
  revenueThisMonth: number;
  ordersThisMonth: number;
  previousMonthRevenue: number;
  previousMonthOrders: number;
  revenueGrowth: number;
  orderGrowth: number;
  timestamp: string;
}

interface CohortMetrics {
  cohort: string;
  customerCount: number;
  totalRevenue: number;
  averageRevenuePerCustomer: number;
  repeatPurchaseRate: number;
  retentionRate: number;
}

interface RevenueForecast {
  predictedNext7Days: number;
  predictedNext30Days: number;
  confidence: number;
  basedOnHistoricalDays: number;
  seasonalFactor: number;
  trend: "up" | "down" | "stable";
}

interface AnomalyReport {
  detected: boolean;
  anomalies: Array<{
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}

const GMV_CACHE_PREFIX = "economic:gmv";
const FORECAST_CACHE_TTL = 3600;
const ANOMALY_THRESHOLD = 0.5;

export class EconomicIntelligence {
  async computeGMV(): Promise<GMVMetrics> {
    const cached = await withRedis(async (redis) => {
      const raw = await redis.get(`${GMV_CACHE_PREFIX}:current`);
      return raw ? (JSON.parse(raw) as GMVMetrics) : null;
    }, null as GMVMetrics | null);

    if (cached) return cached;

    const supabase = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const [totalResult, todayResult, weekResult, monthResult, prevMonthResult] = await Promise.all([
      supabase.from("orders").select("total", { count: "exact", head: false }).in("payment_status", ["paid", "cod"]),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", todayStart),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", weekStart),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", monthStart),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", prevMonthStart).lte("paid_at", prevMonthEnd),
    ]);

    const totalRevenue = (totalResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const totalOrders = totalResult.count ?? 0;
    const revenueToday = (todayResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const ordersToday = todayResult.data?.length ?? 0;
    const revenueThisWeek = (weekResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const ordersThisWeek = weekResult.data?.length ?? 0;
    const revenueThisMonth = (monthResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const ordersThisMonth = monthResult.data?.length ?? 0;
    const previousMonthRevenue = (prevMonthResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const previousMonthOrders = prevMonthResult.data?.length ?? 0;

    const metrics: GMVMetrics = {
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      revenueToday,
      ordersToday,
      revenueThisWeek,
      ordersThisWeek,
      revenueThisMonth,
      ordersThisMonth,
      previousMonthRevenue,
      previousMonthOrders,
      revenueGrowth: previousMonthRevenue > 0 ? ((revenueThisMonth - previousMonthRevenue) / previousMonthRevenue) * 100 : 0,
      orderGrowth: previousMonthOrders > 0 ? ((ordersThisMonth - previousMonthOrders) / previousMonthOrders) * 100 : 0,
      timestamp: new Date().toISOString(),
    };

    await withRedis(async (redis) => {
      await redis.setex(`${GMV_CACHE_PREFIX}:current`, 300, JSON.stringify(metrics));
      await redis.lpush(`${GMV_CACHE_PREFIX}:history`, JSON.stringify(metrics));
      await redis.ltrim(`${GMV_CACHE_PREFIX}:history`, 0, 479);
      return true;
    }, false);

    return metrics;
  }

  async getGMVHistory(hours = 24): Promise<GMVMetrics[]> {
    return withRedis(async (redis) => {
      const raw = await redis.lrange(`${GMV_CACHE_PREFIX}:history`, 0, hours * 12);
      return raw.map((r) => JSON.parse(r) as GMVMetrics);
    }, [] as GMVMetrics[]);
  }

  async computeCohorts(): Promise<CohortMetrics[]> {
    const supabase = createAdminClient();
    const { data: customers } = await supabase
      .from("orders")
      .select("user_id, total, created_at, payment_status")
      .in("payment_status", ["paid", "cod"])
      .order("created_at", { ascending: true })
      .limit(10000);

    if (!customers || customers.length === 0) return [];

    const userFirstOrder = new Map<string, string>();
    const userOrders = new Map<string, { count: number; revenue: number }>();
    const userMonths = new Map<string, Set<string>>();

    for (const order of customers) {
      const uid = order.user_id;
      const month = order.created_at.slice(0, 7);

      if (!userFirstOrder.has(uid)) {
        userFirstOrder.set(uid, month);
      }

      const existing = userOrders.get(uid) ?? { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += Number(order.total);
      userOrders.set(uid, existing);

      if (!userMonths.has(uid)) userMonths.set(uid, new Set());
      userMonths.get(uid)!.add(month);
    }

    const cohortMap = new Map<string, { customers: Set<string>; revenue: number; orders: number }>();

    for (const [uid, cohort] of userFirstOrder) {
      if (!cohortMap.has(cohort)) {
        cohortMap.set(cohort, { customers: new Set(), revenue: 0, orders: 0 });
      }
      const entry = cohortMap.get(cohort)!;
      entry.customers.add(uid);
      entry.revenue += userOrders.get(uid)?.revenue ?? 0;
      entry.orders += userOrders.get(uid)?.count ?? 0;
    }

    const cohorts: CohortMetrics[] = [];
    for (const [cohort, data] of cohortMap) {
      const customerCount = data.customers.size;
      const repeatBuyers = Array.from(data.customers).filter((uid) => (userOrders.get(uid)?.count ?? 0) > 1).length;
      const activeMonths = new Set<string>();
      for (const uid of data.customers) {
        const months = userMonths.get(uid);
        if (months) {
          for (const m of months) activeMonths.add(m);
        }
      }

      cohorts.push({
        cohort,
        customerCount,
        totalRevenue: data.revenue,
        averageRevenuePerCustomer: customerCount > 0 ? data.revenue / customerCount : 0,
        repeatPurchaseRate: customerCount > 0 ? (repeatBuyers / customerCount) * 100 : 0,
        retentionRate: customerCount > 0 ? (activeMonths.size / Math.max(1, cohortMap.size)) * 100 : 0,
      });
    }

    return cohorts.sort((a, b) => b.cohort.localeCompare(a.cohort));
  }

  async forecastRevenue(): Promise<RevenueForecast> {
    const cached = await withRedis(async (redis) => {
      const raw = await redis.get(`${GMV_CACHE_PREFIX}:forecast`);
      return raw ? (JSON.parse(raw) as RevenueForecast) : null;
    }, null as RevenueForecast | null);

    if (cached) return cached;

    const supabase = createAdminClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data: last30Days } = await supabase
      .from("orders")
      .select("total, created_at")
      .in("payment_status", ["paid", "cod"])
      .gte("created_at", thirtyDaysAgo);

    if (!last30Days || last30Days.length < 7) {
      return { predictedNext7Days: 0, predictedNext30Days: 0, confidence: 0.1, basedOnHistoricalDays: 0, seasonalFactor: 1, trend: "stable" };
    }

    const dailyRevenue = new Map<string, number>();
    for (const order of last30Days) {
      const day = order.created_at.slice(0, 10);
      dailyRevenue.set(day, (dailyRevenue.get(day) ?? 0) + Number(order.total));
    }

    const sortedDays = Array.from(dailyRevenue.entries()).sort(([a], [b]) => a.localeCompare(b));
    const revenues = sortedDays.map(([, r]) => r);

    const avg7 = revenues.slice(-7).reduce((s, r) => s + r, 0) / Math.min(7, revenues.length);
    const avg30 = revenues.reduce((s, r) => s + r, 0) / revenues.length;
    const growth = avg30 > 0 ? (avg7 - avg30) / avg30 : 0;
    const volatility = revenues.length > 1
      ? Math.sqrt(revenues.reduce((s, r) => s + (r - avg30) ** 2, 0) / revenues.length) / avg30
      : 1;

    const confidence = Math.max(0.1, Math.min(0.95, 1 - volatility * 2));
    const trend: "up" | "down" | "stable" = growth > 0.1 ? "up" : growth < -0.1 ? "down" : "stable";

    const forecast: RevenueForecast = {
      predictedNext7Days: Math.round(avg7 * 7 * (1 + growth)),
      predictedNext30Days: Math.round(avg30 * 30 * (1 + growth)),
      confidence,
      basedOnHistoricalDays: revenues.length,
      seasonalFactor: 1,
      trend,
    };

    await withRedis(async (redis) => {
      await redis.setex(`${GMV_CACHE_PREFIX}:forecast`, FORECAST_CACHE_TTL, JSON.stringify(forecast));
      return true;
    }, false);

    return forecast;
  }

  async detectAnomalies(): Promise<AnomalyReport> {
    const supabase = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

    const [todayResult, yesterdayResult, lastHourResult, prevHourResult] = await Promise.all([
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", todayStart),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", yesterdayStart).lt("paid_at", todayStart),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", new Date(Date.now() - 3600000).toISOString()),
      supabase.from("orders").select("total").in("payment_status", ["paid", "cod"]).gte("paid_at", new Date(Date.now() - 7200000).toISOString()).lt("paid_at", new Date(Date.now() - 3600000).toISOString()),
    ]);

    const revenueToday = (todayResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const revenueYesterday = (yesterdayResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const revenueLastHour = (lastHourResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const revenuePrevHour = (prevHourResult.data ?? []).reduce((s, r) => s + Number(r.total), 0);

    const anomalies: AnomalyReport["anomalies"] = [];

    if (revenueYesterday > 0) {
      const dailyDeviation = Math.abs(revenueToday - revenueYesterday) / revenueYesterday;
      if (dailyDeviation > ANOMALY_THRESHOLD) {
        anomalies.push({
          metric: "daily_revenue",
          currentValue: revenueToday,
          expectedValue: revenueYesterday,
          deviation: dailyDeviation,
          severity: dailyDeviation > 1 ? "critical" : dailyDeviation > 0.75 ? "high" : "medium",
        });
      }
    }

    if (revenuePrevHour > 0) {
      const hourlyDeviation = Math.abs(revenueLastHour - revenuePrevHour) / revenuePrevHour;
      if (hourlyDeviation > ANOMALY_THRESHOLD) {
        anomalies.push({
          metric: "hourly_revenue",
          currentValue: revenueLastHour,
          expectedValue: revenuePrevHour,
          deviation: hourlyDeviation,
          severity: hourlyDeviation > 1 ? "high" : "medium",
        });
      }
    }

    if (anomalies.length > 0) {
      logWarn("economic.anomaly_detected", { anomalies: anomalies.map((a) => a.metric), traceId: getTraceId() });
    }

    return { detected: anomalies.length > 0, anomalies };
  }

  getMetricPrefix() {
    return GMV_CACHE_PREFIX;
  }
}

export const economicIntelligence = new EconomicIntelligence();
