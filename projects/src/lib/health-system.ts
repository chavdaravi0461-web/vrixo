import "server-only";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getAllCircuitStats } from "@/lib/circuit-breaker";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheck {
  name: string;
  critical: boolean;
  check: () => Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  checks: HealthCheckResult[];
  circuitBreakers: Record<string, unknown>;
  degradedServices: string[];
  failedServices: string[];
}

const healthChecks: HealthCheck[] = [];

export function registerHealthCheck(check: HealthCheck): void {
  healthChecks.push(check);
}

export async function runHealthCheck(): Promise<SystemHealth> {
  const results = await Promise.all(
    healthChecks.map(async (check) => {
      const start = Date.now();
      try {
        const result = await check.check();
        return { ...result, name: check.name, critical: check.critical };
      } catch (error) {
        return {
          name: check.name,
          critical: check.critical,
          status: "unhealthy" as HealthStatus,
          latencyMs: Date.now() - start,
          error: error instanceof Error ? error.message : "Unknown failure",
        };
      }
    })
  );

  const degradedServices = results.filter((r) => r.status === "degraded").map((r) => r.name);
  const failedServices = results.filter((r) => r.status === "unhealthy").map((r) => r.name);

  const criticalFailed = results.some((r) => r.critical && r.status === "unhealthy");
  const anyFailed = failedServices.length > 0;

  const circuitStats: Record<string, unknown> = {};
  for (const [name, stats] of getAllCircuitStats()) {
    circuitStats[name] = stats;
  }

  const status: HealthStatus = criticalFailed ? "unhealthy" : anyFailed ? "degraded" : "healthy";

  if (status !== "healthy") {
    const logFn = status === "unhealthy" ? logError : logWarn;
    logFn("health.system_issue", {
      status,
      degraded: degradedServices,
      failed: failedServices,
      circuitBreakers: Object.keys(circuitStats).filter((k) => (circuitStats[k] as any)?.state !== "closed"),
    });
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    checks: results,
    circuitBreakers: circuitStats,
    degradedServices,
    failedServices,
  };
}

export function createSimpleHealthCheck(
  name: string,
  critical: boolean,
  checkFn: () => Promise<boolean>,
  detailsFn?: () => Promise<Record<string, unknown>>
): HealthCheck {
  return {
    name,
    critical,
    check: async () => {
      const start = Date.now();
      const ok = await checkFn();
      const latencyMs = Date.now() - start;
      const details = detailsFn ? await detailsFn().catch(() => undefined) : undefined;
      return {
        status: ok ? "healthy" : critical ? "unhealthy" : "degraded",
        latencyMs,
        error: ok ? undefined : `${name} check failed`,
        details,
      };
    },
  };
}
