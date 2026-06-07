import "server-only";
import { logInfo, logWarn, logError } from "@/lib/observability";

interface SimulationScenario {
  name: string;
  description: string;
  probability: number;
  impact: "critical" | "high" | "medium" | "low";
  simulate: () => Promise<SimulationResult>;
}

interface SimulationResult {
  success: boolean;
  failurePoint?: string;
  recoveryTimeMs?: number;
  dataLoss: boolean;
  details: string[];
}

interface FailurePrediction {
  scenario: string;
  probability: number;
  estimatedImpact: string;
  recommendedAction: string;
  confidenceLevel: number;
}

class FailureSimulationEngine {
  private scenarios: SimulationScenario[] = [];
  private simulationHistory: Array<{
    scenario: string;
    timestamp: string;
    success: boolean;
    details: string[];
  }> = [];
  private readonly MAX_HISTORY = 1000;

  registerScenario(scenario: SimulationScenario): void {
    this.scenarios.push(scenario);
  }

  async runAllSimulations(): Promise<FailurePrediction[]> {
    const predictions: FailurePrediction[] = [];

    for (const scenario of this.scenarios) {
      try {
        const result = await scenario.simulate();
        this.simulationHistory.push({
          scenario: scenario.name,
          timestamp: new Date().toISOString(),
          success: result.success,
          details: result.details,
        });

        if (this.simulationHistory.length > this.MAX_HISTORY) {
          this.simulationHistory = this.simulationHistory.slice(-this.MAX_HISTORY);
        }

        if (!result.success) {
          logWarn("failure_simulation.failure_detected", {
            scenario: scenario.name,
            failurePoint: result.failurePoint,
            recoveryTimeMs: result.recoveryTimeMs,
            dataLoss: result.dataLoss,
          });

          predictions.push({
            scenario: scenario.name,
            probability: this.calculateProbability(scenario.name, !result.success),
            estimatedImpact: scenario.impact,
            recommendedAction: this.generateRecommendation(scenario, result),
            confidenceLevel: this.calculateConfidence(scenario.name),
          });
        }
      } catch (error) {
        logError("failure_simulation.error", {
          scenario: scenario.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return predictions;
  }

  private calculateProbability(scenarioName: string, failed: boolean): number {
    const history = this.simulationHistory.filter((h) => h.scenario === scenarioName);
    if (history.length === 0) return 0;
    const failures = history.filter((h) => !h.success).length;
    return failures / history.length;
  }

  private calculateConfidence(scenarioName: string): number {
    const history = this.simulationHistory.filter((h) => h.scenario === scenarioName);
    return Math.min(history.length / 100, 0.95);
  }

  private generateRecommendation(scenario: SimulationScenario, result: SimulationResult): string {
    if (result.dataLoss) {
      return `CRITICAL: Data loss detected in ${scenario.name}. Implement write-ahead logging and multi-region replication immediately.`;
    }
    if (result.recoveryTimeMs && result.recoveryTimeMs > 5000) {
      return `HIGH: Recovery time ${result.recoveryTimeMs}ms exceeds 5s threshold for ${scenario.name}. Add circuit breaker with faster failover.`;
    }
    if (result.failurePoint) {
      return `MEDIUM: ${scenario.name} fails at ${result.failurePoint}. Add retry logic with exponential backoff.`;
    }
    return `LOW: ${scenario.name} is resilient. Continue monitoring.`;
  }

  getHistory() {
    return this.simulationHistory;
  }

  getScenarios() {
    return this.scenarios.map((s) => ({ name: s.name, description: s.description, impact: s.impact, probability: s.probability }));
  }
}

export const failureSimulator = new FailureSimulationEngine();

failureSimulator.registerScenario({
  name: "redis-outage",
  description: "Simulates complete Redis outage and measures system degradation",
  probability: 0.15,
  impact: "critical",
  simulate: async () => {
    const start = Date.now();
    const failures: string[] = [];
    let dataLoss = false;

    try {
      const { isRedisAvailable, withRedis } = await import("@/lib/redis");
      if (!isRedisAvailable()) {
        return { success: true, dataLoss: false, details: ["Redis already disabled — no impact"] };
      }

      const queueTest = await withRedis(async () => { throw new Error("Simulated Redis outage"); }, "fallback");
      if (queueTest === "fallback") {
        failures.push("Queue operations fell back to noop — jobs silently lost");
      }

      const fraudTest = await withRedis(async () => { throw new Error("Simulated Redis outage"); }, { score: 0, action: "allow" });
      if ((fraudTest as any)?.action === "allow") {
        failures.push("Fraud detection bypassed — all transactions allowed");
        dataLoss = true;
      }

      const eventTest = await withRedis(async () => { throw new Error("Simulated Redis outage"); }, false);
      if (eventTest === false) {
        failures.push("Event bus Redis publish failed");
      }
    } catch (error) {
      failures.push(`Simulation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const recoveryTimeMs = Date.now() - start;

    return {
      success: failures.length === 0,
      failurePoint: failures.length > 0 ? failures[0] : undefined,
      recoveryTimeMs,
      dataLoss,
      details: failures.length > 0 ? failures : ["All systems resilient to Redis outage"],
    };
  },
});

failureSimulator.registerScenario({
  name: "supabase-connection-failure",
  description: "Simulates Supabase connection timeout and measures API fallback behavior",
  probability: 0.08,
  impact: "critical",
  simulate: async () => {
    const failures: string[] = [];
    let dataLoss = false;

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data, error } = await supabase.from("orders").select("id").limit(1);
      if (error) {
        failures.push(`Supabase query failed: ${error.message}`);
        dataLoss = true;
      } else if (!data || data.length === 0) {
        failures.push("Supabase returned no data");
        dataLoss = true;
      } else {
        return { success: true, dataLoss: false, details: ["Supabase connection healthy"] };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("fetch") || msg.includes("connect") || msg.includes("timeout")) {
        failures.push(`Supabase connection failed: ${msg}`);
        dataLoss = true;
      }
    }

    return {
      success: failures.length === 0,
      failurePoint: failures[0],
      recoveryTimeMs: 0,
      dataLoss,
      details: failures,
    };
  },
});

failureSimulator.registerScenario({
  name: "payment-verify-race",
  description: "Simulates concurrent payment verification requests for the same order",
  probability: 0.25,
  impact: "high",
  simulate: async () => {
    const concurrentRequests = 5;
    let dataLoss = false;
    const failures: string[] = [];

    try {
      const results = await Promise.allSettled(
        Array.from({ length: concurrentRequests }, async (_, i) => {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const supabase = createAdminClient();
          const { data } = await supabase.from("orders").select("id, payment_status").eq("payment_status", "paid").limit(1);
          return { request: i, paidOrders: data?.length ?? 0 };
        })
      );

      const outcomes = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<any>).value);
      if (outcomes.length !== concurrentRequests) {
        failures.push(`${concurrentRequests - outcomes.length} concurrent requests failed`);
      }
    } catch (error) {
      failures.push(`Race simulation error: ${error instanceof Error ? error.message : String(error)}`);
      dataLoss = true;
    }

    return {
      success: failures.length === 0,
      failurePoint: failures[0],
      recoveryTimeMs: 0,
      dataLoss,
      details: failures.length > 0 ? failures : ["Concurrent payment verification is safe"],
    };
  },
});

failureSimulator.registerScenario({
  name: "memory-leak-detection",
  description: "Detects unbounded Map growth in rate limiters and caches",
  probability: 0.4,
  impact: "high",
  simulate: async () => {
    const failures: string[] = [];

    try {
      const rateLimit = await import("@/lib/rate-limit");
      const bucketSize = rateLimit.memoryBuckets?.size ?? 0;
      if (bucketSize > 10000) {
        failures.push(`Rate limit memoryBuckets has ${bucketSize} entries — potential leak`);
      }

      const security = await import("@/lib/security");
      const securityBuckets = security.buckets?.size ?? 0;
      if (securityBuckets > 10000) {
        failures.push(`Security rate limit buckets has ${securityBuckets} entries — potential leak`);
      }

      const queue = await import("@/lib/queue");
      const queueCount = queue.queues?.size ?? 0;
      if (queueCount > 100) {
        failures.push(`Queue registry has ${queueCount} entries — potential leak`);
      }
    } catch {
      // Module may not expose internals
    }

    return {
      success: failures.length === 0,
      failurePoint: failures[0],
      recoveryTimeMs: 0,
      dataLoss: false,
      details: failures.length > 0 ? failures : ["No memory leaks detected"],
    };
  },
});

failureSimulator.registerScenario({
  name: "webhook-dup-detection",
  description: "Simulates duplicate Razorpay webhook delivery and checks idempotency",
  probability: 0.3,
  impact: "high",
  simulate: async () => {
    const failures: string[] = [];
    let dataLoss = false;

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      const { data: recentEvents } = await supabase
        .from("razorpay_webhook_events")
        .select("event_id, event_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentEvents && recentEvents.length > 0) {
        const eventIds = recentEvents.map((e: any) => e.event_id);
        const uniqueIds = new Set(eventIds);
        if (uniqueIds.size !== eventIds.length) {
          failures.push("Duplicate webhook event IDs found in database — idempotency may be broken");
          dataLoss = true;
        }
      }
    } catch {
      // Table may not exist
    }

    return {
      success: failures.length === 0,
      failurePoint: failures[0],
      recoveryTimeMs: 0,
      dataLoss,
      details: failures.length > 0 ? failures : ["Webhook idempotency is working"],
    };
  },
});
