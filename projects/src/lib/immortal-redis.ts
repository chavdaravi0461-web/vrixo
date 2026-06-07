import "server-only";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { createCircuitBreaker, type CircuitBreaker } from "@/lib/circuit-breaker";
import { registerHealthCheck, createSimpleHealthCheck } from "@/lib/health-system";

interface ImmortalRedisConfig {
  maxRetries: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: ImmortalRedisConfig = {
  maxRetries: 10,
  circuitFailureThreshold: 3,
  circuitCooldownMs: 15_000,
  healthCheckIntervalMs: 30_000,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

type HealthStatus = "healthy" | "degraded" | "unhealthy";

class ImmortalRedisCore {
  private client: RedisClient | null = null;
  private circuit: CircuitBreaker | null = null;
  private config: ImmortalRedisConfig;
  private healthStatus: HealthStatus = "degraded";
  private lastSuccessfulPing = 0;
  private consecutiveFailures = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackMode = false;
  private pendingOperations = 0;

  constructor(config?: Partial<ImmortalRedisConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(getClient: () => Promise<RedisClient | null>): Promise<void> {
    this.circuit = createCircuitBreaker("redis-immortal", {
      failureThreshold: this.config.circuitFailureThreshold,
      cooldownMs: this.config.circuitCooldownMs,
      name: "redis-immortal",
    });

    const client = await getClient();
    if (client) {
      this.client = client;
      this.fallbackMode = false;
      try {
        await client.ping();
        this.healthStatus = "healthy";
        this.lastSuccessfulPing = Date.now();
        this.consecutiveFailures = 0;
        logInfo("redis.immortal.connected");
      } catch {
        this.healthStatus = "degraded";
        logWarn("redis.immortal.initial_ping_failed");
      }
    } else {
      this.fallbackMode = true;
      this.healthStatus = "degraded";
      logWarn("redis.immortal.no_client");
    }

    this.healthTimer = setInterval(() => this.healthCheck(), this.config.healthCheckIntervalMs);

    registerHealthCheck(createSimpleHealthCheck(
      "redis-immortal",
      false,
      async () => this.healthStatus !== "unhealthy",
      async () => ({
        status: this.healthStatus,
        lastPing: this.lastSuccessfulPing ? new Date(this.lastSuccessfulPing).toISOString() : null,
        consecutiveFailures: this.consecutiveFailures,
        fallbackMode: this.fallbackMode,
        circuitState: this.circuit?.getState(),
        pendingOps: this.pendingOperations,
      })
    ));
  }

  private async healthCheck(): Promise<void> {
    if (!this.client || this.fallbackMode) {
      this.healthStatus = "degraded";
      return;
    }
    try {
      await this.client.ping();
      this.healthStatus = "healthy";
      this.lastSuccessfulPing = Date.now();
      this.consecutiveFailures = 0;
    } catch {
      this.consecutiveFailures++;
      this.healthStatus = this.consecutiveFailures >= 5 ? "unhealthy" : "degraded";
      if (this.consecutiveFailures === 5) {
        logError("redis.immortal.connection_lost", { consecutiveFailures: this.consecutiveFailures });
      }
    }
  }

  async withRedis<T>(
    operation: (client: RedisClient) => Promise<T>,
    fallback: () => T,
    operationName = "redis-op"
  ): Promise<T> {
    this.pendingOperations++;

    if (this.fallbackMode || !this.client || !this.circuit) {
      this.pendingOperations--;
      return fallback();
    }

    try {
      const result = await this.circuit.call(
        async () => {
          this.consecutiveFailures = 0;
          return operation(this.client!);
        },
        async () => {
          this.healthStatus = "degraded";
          logWarn("redis.immortal.circuit_fallback", { operation: operationName });
          return fallback();
        }
      );
      this.pendingOperations--;
      return result;
    } catch (error) {
      this.pendingOperations--;
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.healthStatus !== "unhealthy" && !this.fallbackMode;
  }

  getHealthStatus(): HealthStatus {
    return this.healthStatus;
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  getCircuitBreaker(): CircuitBreaker | null {
    return this.circuit;
  }

  async destroy(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.client) {
      try { await this.client.quit(); } catch {}
      this.client = null;
    }
    this.healthStatus = "degraded";
  }
}

export const immortalRedis = new ImmortalRedisCore();
