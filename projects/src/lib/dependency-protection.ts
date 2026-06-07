/**
 * Dependency protection — unified wrapper combining circuit breaker,
 * concurrency guard, P95 tracking, failure metrics, and backpressure.
 *
 * Every external dependency call goes through this single function,
 * which enforces:
 *   - Backpressure check (shed load when critical)
 *   - Circuit breaker (fast-fail when dependency is unhealthy)
 *   - Concurrency guard (prevent resource exhaustion)
 *   - P95 latency tracking
 *   - Failure metrics
 *   - Success/failure recording
 *
 * Usage:
 *   const result = await withProtection("supabase-db", () => supabase.from("orders").select("*"), []);
 *   const result = await withProtection("whatsapp-cloud-api", () => sendMessage(phone, msg), null);
 */

import { createCircuitBreaker, type CircuitBreaker } from "@/lib/circuit-breaker";
import { isOverloaded } from "@/lib/backpressure";
import {
  dbConcurrencyGuard,
  redisConcurrencyGuard,
  whatsappConcurrencyGuard,
  aiConcurrencyGuard,
} from "@/lib/concurrency-guard";
import {
  dbLatencyTracker,
  redisLatencyTracker,
  whatsappLatencyTracker,
  aiLatencyTracker,
} from "@/lib/p95-tracker";
import { recordFailure } from "@/lib/failure-metrics";
import { classifyError } from "@/lib/reliability-types";

type DependencyKind = "supabase" | "redis" | "whatsapp" | "ai" | "payment" | "queue" | "event-bus" | "external-http" | "database";

const dependencyCircuitConfigs: Record<string, { kind: DependencyKind; threshold: number; cooldown: number; critical: boolean }> = {
  "supabase-db":    { kind: "supabase",    threshold: 8,  cooldown: 30_000, critical: true },
  "redis-primary":  { kind: "redis",       threshold: 5,  cooldown: 15_000, critical: true },
  "razorpay-api":   { kind: "payment",     threshold: 5,  cooldown: 20_000, critical: true },
  "whatsapp-cloud-api": { kind: "whatsapp",   threshold: 10, cooldown: 30_000, critical: false },
  "openai-api":     { kind: "ai",          threshold: 5,  cooldown: 60_000, critical: false },
  "bullmq-queue":   { kind: "queue",       threshold: 8,  cooldown: 15_000, critical: true },
  "event-bus-redis": { kind: "event-bus",  threshold: 5,  cooldown: 15_000, critical: true },
  "checkout-session": { kind: "database",  threshold: 10, cooldown: 10_000, critical: true },
  "coupon-validation": { kind: "database",  threshold: 15, cooldown: 30_000, critical: false },
  "product-catalog": { kind: "database",   threshold: 10, cooldown: 15_000, critical: true },
  "order-processing": { kind: "database",  threshold: 8,  cooldown: 20_000, critical: true },
  "payment-verify": { kind: "external-http", threshold: 5, cooldown: 15_000, critical: true },
  "fraud-detection": { kind: "database",   threshold: 12, cooldown: 30_000, critical: false },
  "user-auth":      { kind: "supabase",    threshold: 8,  cooldown: 20_000, critical: true },
};

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(name: string): CircuitBreaker {
  let breaker = breakers.get(name);
  if (!breaker) {
    const config = dependencyCircuitConfigs[name];
    breaker = createCircuitBreaker(name, {
      failureThreshold: config?.threshold ?? 5,
      cooldownMs: config?.cooldown ?? 30_000,
      name,
    });
    breakers.set(name, breaker);
  }
  return breaker;
}

function getConcurrencyGuard(kind: DependencyKind) {
  switch (kind) {
    case "supabase":
    case "database":
      return dbConcurrencyGuard;
    case "redis":
    case "queue":
    case "event-bus":
      return redisConcurrencyGuard;
    case "whatsapp":
      return whatsappConcurrencyGuard;
    case "ai":
      return aiConcurrencyGuard;
    default:
      return dbConcurrencyGuard;
  }
}

function getLatencyTracker(kind: DependencyKind) {
  switch (kind) {
    case "supabase":
    case "database":
      return dbLatencyTracker;
    case "redis":
    case "queue":
    case "event-bus":
      return redisLatencyTracker;
    case "whatsapp":
      return whatsappLatencyTracker;
    case "ai":
      return aiLatencyTracker;
    default:
      return dbLatencyTracker;
  }
}

function getFailureCategory(kind: DependencyKind): Parameters<typeof recordFailure>[0] {
  switch (kind) {
    case "supabase": return "supabase";
    case "redis": return "redis";
    case "whatsapp": return "whatsapp";
    case "ai": return "ai";
    case "payment": return "payment";
    case "queue": return "queue";
    case "event-bus": return "event-bus";
    case "external-http": return "webhook";
    case "database": return "supabase";
  }
}

export async function withProtection<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const config = dependencyCircuitConfigs[name];
  const kind = config?.kind ?? "database";

  // 1. Backpressure — shed load if critical
  if (isOverloaded()) {
    console.warn(`[protection] load shedding ${name} — system critical`);
    recordFailure(getFailureCategory(kind), "load_shedding");
    return fallback;
  }

  // 2. Circuit breaker — fast-fail if dependency is unhealthy
  const breaker = getBreaker(name);

  // 3. Concurrency guard — prevent resource exhaustion
  const guard = getConcurrencyGuard(kind);

  // 4. Latency tracker
  const tracker = getLatencyTracker(kind);
  const stop = tracker.start();

  try {
    const result = await breaker.call(
      async () => {
        return guard.run(fn);
      },
      async () => {
        console.warn(`[protection] circuit open for ${name} — using fallback`);
        recordFailure(getFailureCategory(kind), `circuit_open:${name}`);
        return fallback;
      },
    );
    stop();
    return result;
  } catch (error) {
    stop();
    const classified = classifyError(error);
    recordFailure(getFailureCategory(kind), classified.type);
    throw error;
  }
}

export function getProtectedBreakerStats() {
  const stats: Array<{ name: string; state: string; failures: number; totalFailures: number }> = [];
  for (const [name, breaker] of breakers) {
    const s = breaker.getStats();
    stats.push({ name, state: s.state, failures: s.failures, totalFailures: s.totalFailures });
  }
  return stats;
}

export function forceProtectionOpen(name: string): void {
  const breaker = getBreaker(name);
  breaker.forceOpen();
}

export function forceProtectionClosed(name: string): void {
  const breaker = getBreaker(name);
  breaker.forceClosed();
}
