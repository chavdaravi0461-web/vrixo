import "server-only";
import { logInfo } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerHealthCheck, createSimpleHealthCheck } from "@/lib/health-system";

interface SegmentInsight {
  segment: string;
  customerCount: number;
  averageOrderValue: number;
  totalRevenue: number;
  conversionRate: number;
  repeatRate: number;
  topProducts: Array<{ title: string; count: number }>;
}

interface AnomalySignal {
  type: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
}

class CommerceIntelligence {
  private lastAnalysis: string | null = null;
  private anomalies: AnomalySignal[] = [];
  private readonly MAX_ANOMALIES = 10_000;

  constructor() {
    registerHealthCheck(createSimpleHealthCheck(
      "commerce-intelligence",
      false,
      async () => true,
      async () => ({
        lastAnalysis: this.lastAnalysis,
        trackedAnomalies: this.anomalies.length,
      })
    ));
  }

  async analyzeSegments(): Promise<SegmentInsight[]> {
    const supabase = createAdminClient();
    const insights: SegmentInsight[] = [];

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, total_orders, total_spent")
        .limit(10_000);

      if (!profiles) return [];

      const segments = new Map<string, { count: number; totalOrders: number; totalSpent: number }>();

      for (const profile of profiles) {
        const orders = Number(profile.total_orders ?? 0);
        const spent = Number(profile.total_spent ?? 0);
        let segment: string;

        if (orders === 0) segment = "inactive";
        else if (orders === 1) segment = "first-time";
        else if (orders < 5) segment = "occasional";
        else if (orders < 15) segment = "regular";
        else segment = "vip";

        const existing = segments.get(segment) ?? { count: 0, totalOrders: 0, totalSpent: 0 };
        existing.count++;
        existing.totalOrders += orders;
        existing.totalSpent += spent;
        segments.set(segment, existing);
      }

      for (const [segment, data] of segments) {
        const avgOrders = data.count > 0 ? data.totalOrders / data.count : 0;
        const avgSpent = data.count > 0 ? data.totalSpent / data.count : 0;

        insights.push({
          segment,
          customerCount: data.count,
          averageOrderValue: avgSpent,
          totalRevenue: data.totalSpent,
          conversionRate: segment === "inactive" ? 0 : avgOrders > 0 ? Math.min(avgOrders / 10, 1) : 0,
          repeatRate: segment === "first-time" ? 0 : avgOrders > 1 ? Math.min((avgOrders - 1) / avgOrders, 1) : 0,
          topProducts: [],
        });
      }

      this.lastAnalysis = new Date().toISOString();
    } catch {
      // Analysis failed — return partial results
    }

    return insights.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async detectAnomalies(): Promise<AnomalySignal[]> {
    const supabase = createAdminClient();
    const newAnomalies: AnomalySignal[] = [];

    try {
      const hourAgo = new Date(Date.now() - 3600_000).toISOString();
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

      const [{ count: recentOrders }, { count: historicalOrders }] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
      ]);

      const recentCount = recentOrders ?? 0;
      const historicalCount = historicalOrders ?? 0;
      const expectedPerHour = historicalCount / 24;

      if (expectedPerHour > 0) {
        const deviation = Math.abs(recentCount - expectedPerHour) / expectedPerHour;
        if (deviation > 0.5) {
          newAnomalies.push({
            type: "traffic-anomaly",
            metric: "orders/hour",
            currentValue: recentCount,
            expectedValue: Math.round(expectedPerHour),
            deviation: Math.round(deviation * 100),
            severity: deviation > 1.0 ? "critical" : deviation > 0.75 ? "high" : "medium",
            timestamp: new Date().toISOString(),
          });
        }
      }

      const [{ data: failedPayments, count: failedCount }, { data: allPayments, count: allCount }] = await Promise.all([
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", hourAgo),
        supabase.from("payments").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
      ]);

      const failRate = allCount && allCount > 0 ? (failedCount ?? 0) / allCount : 0;
      if (failRate > 0.2) {
        newAnomalies.push({
          type: "payment-failure-spike",
          metric: "payment_failure_rate",
          currentValue: Math.round(failRate * 100),
          expectedValue: 10,
          deviation: Math.round(Math.abs(failRate - 0.1) / 0.1 * 100),
          severity: failRate > 0.4 ? "critical" : "high",
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Anomaly detection failed
    }

    this.anomalies.push(...newAnomalies);
    if (this.anomalies.length > this.MAX_ANOMALIES) {
      this.anomalies = this.anomalies.slice(-this.MAX_ANOMALIES / 2);
    }

    return newAnomalies;
  }

  getAnomalies(limit = 100): AnomalySignal[] {
    return this.anomalies.slice(-limit).reverse();
  }

  getLastAnalysis(): string | null {
    return this.lastAnalysis;
  }
}

export const commerceIntel = new CommerceIntelligence();
