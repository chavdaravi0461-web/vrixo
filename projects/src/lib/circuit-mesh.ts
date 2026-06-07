import "server-only";
import { createCircuitBreaker } from "@/lib/circuit-breaker";

interface CircuitConfig {
  failureThreshold?: number;
  cooldownMs?: number;
  name?: string;
}
import { logInfo, logWarn } from "@/lib/observability";
import { withRedis } from "@/lib/redis";

interface DependencyDef {
  name: string;
  type: "redis" | "supabase" | "razorpay" | "whatsapp" | "openai" | "queue" | "external-http" | "database";
  critical: boolean;
  circuitConfig: Partial<CircuitConfig>;
}

const DEPENDENCIES: DependencyDef[] = [
  { name: "redis-primary", type: "redis", critical: true, circuitConfig: { failureThreshold: 5, cooldownMs: 15_000 } },
  { name: "supabase-db", type: "supabase", critical: true, circuitConfig: { failureThreshold: 8, cooldownMs: 30_000 } },
  { name: "razorpay-api", type: "razorpay", critical: true, circuitConfig: { failureThreshold: 5, cooldownMs: 20_000 } },
  { name: "razorpay-webhook", type: "external-http", critical: true, circuitConfig: { failureThreshold: 10, cooldownMs: 60_000 } },
  { name: "whatsapp-cloud-api", type: "whatsapp", critical: false, circuitConfig: { failureThreshold: 10, cooldownMs: 30_000 } },
  { name: "openai-api", type: "openai", critical: false, circuitConfig: { failureThreshold: 5, cooldownMs: 60_000 } },
  { name: "bullmq-queue", type: "queue", critical: true, circuitConfig: { failureThreshold: 8, cooldownMs: 15_000 } },
  { name: "event-bus-redis", type: "redis", critical: true, circuitConfig: { failureThreshold: 5, cooldownMs: 15_000 } },
  { name: "checkout-session", type: "database", critical: true, circuitConfig: { failureThreshold: 10, cooldownMs: 10_000 } },
  { name: "coupon-validation", type: "database", critical: false, circuitConfig: { failureThreshold: 15, cooldownMs: 30_000 } },
  { name: "product-catalog", type: "database", critical: true, circuitConfig: { failureThreshold: 10, cooldownMs: 15_000 } },
  { name: "order-processing", type: "database", critical: true, circuitConfig: { failureThreshold: 8, cooldownMs: 20_000 } },
  { name: "payment-verify", type: "external-http", critical: true, circuitConfig: { failureThreshold: 5, cooldownMs: 15_000 } },
  { name: "fraud-detection", type: "database", critical: false, circuitConfig: { failureThreshold: 12, cooldownMs: 30_000 } },
  { name: "admin-session", type: "database", critical: true, circuitConfig: { failureThreshold: 15, cooldownMs: 10_000 } },
  { name: "user-auth", type: "supabase", critical: true, circuitConfig: { failureThreshold: 8, cooldownMs: 20_000 } },
  { name: "telemetry-export", type: "external-http", critical: false, circuitConfig: { failureThreshold: 20, cooldownMs: 120_000 } },
];

interface MeshNode {
  name: string;
  type: DependencyDef["type"];
  critical: boolean;
  breaker: ReturnType<typeof createCircuitBreaker>;
  state: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: number | null;
  lastSuccess: number | null;
}

class CircuitMesh {
  private nodes = new Map<string, MeshNode>();
  private healthCache: {
    status: "healthy" | "degraded" | "unhealthy";
    openCritical: number;
    openNonCritical: number;
    checkedAt: number;
  } | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    for (const dep of DEPENDENCIES) {
      const breaker = createCircuitBreaker(dep.name, {
        failureThreshold: dep.circuitConfig.failureThreshold ?? 5,
        cooldownMs: dep.circuitConfig.cooldownMs ?? 15_000,
        name: dep.name,
      });

      this.nodes.set(dep.name, {
        name: dep.name,
        type: dep.type,
        critical: dep.critical,
        breaker,
        state: "closed",
        failures: 0,
        lastFailure: null,
        lastSuccess: null,
      });
    }

    logInfo("circuit-mesh.initialized", { nodeCount: this.nodes.size });
  }

  async callWithCircuit<T>(
    name: string,
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    const node = this.nodes.get(name);
    if (!node) {
      return fn();
    }

    const result = await node.breaker.call<T>(
      async () => {
        try {
          const value = await fn();
          node.state = "closed";
          node.lastSuccess = Date.now();
          node.failures = 0;
          return value;
        } catch (error) {
          node.failures++;
          node.lastFailure = Date.now();
          node.state = node.failures >= (DEPENDENCIES.find((d) => d.name === name)?.circuitConfig.failureThreshold ?? 5) ? "open" : "closed";
          throw error;
        }
      },
      async () => {
        logWarn("circuit-mesh.fallback", { name, state: node.state });
        return fallback();
      },
    );

    return result;
  }

  recordSuccess(name: string): void {
    const node = this.nodes.get(name);
    if (node) {
      node.state = "closed";
      node.lastSuccess = Date.now();
      node.failures = 0;
    }
  }

  recordFailure(name: string): void {
    const node = this.nodes.get(name);
    if (node) {
      node.failures++;
      node.lastFailure = Date.now();
      if (node.failures >= (DEPENDENCIES.find((d) => d.name === name)?.circuitConfig.failureThreshold ?? 5)) {
        node.state = "open";
      }
    }
  }

  getMeshStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    openCritical: number;
    openNonCritical: number;
    nodes: Array<{
      name: string;
      type: string;
      critical: boolean;
      state: string;
      failures: number;
    }>;
  } {
    const nodes = Array.from(this.nodes.values()).map((n) => ({
      name: n.name,
      type: n.type,
      critical: n.critical,
      state: n.state,
      failures: n.failures,
    }));

    const openCritical = nodes.filter((n) => n.state === "open" && n.critical).length;
    const openNonCritical = nodes.filter((n) => n.state === "open" && !n.critical).length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (openCritical > 0) {
      status = "unhealthy";
    } else if (openNonCritical > 0 || nodes.some((n) => n.state === "half-open")) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return { status, openCritical, openNonCritical, nodes };
  }
}

export const circuitMesh = new CircuitMesh();
