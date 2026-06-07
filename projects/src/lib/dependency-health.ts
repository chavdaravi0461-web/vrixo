import { withRedis } from "@/lib/redis";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import type { DependencyState, ReliabilityStatus } from "@/lib/reliability-types";

type DependencyChecker = {
  name: string;
  check: () => Promise<boolean>;
  timeoutMs: number;
};

const checkers: DependencyChecker[] = [
  {
    name: "supabase",
    check: async () => {
      const client = tryCreateAdminClient();
      const { error } = await client.from("orders").select("id").limit(1);
      return !error;
    },
    timeoutMs: 5_000,
  },
  {
    name: "redis",
    check: async () => {
      return withRedis(async () => true, false);
    },
    timeoutMs: 3_000,
  },
  {
    name: "env",
    check: async () => {
      const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
      const hasSupabaseKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
      return hasSupabaseUrl && hasSupabaseKey;
    },
    timeoutMs: 1_000,
  },
];

const depCache = new Map<string, DependencyState>();

export function getDependencyState(name: string): DependencyState {
  return depCache.get(name) ?? {
    name,
    status: "healthy",
    lastFailureAt: null,
    failureCount: 0,
    degradedMode: false,
  };
}

export function getAllDependencyStates(): DependencyState[] {
  return checkers.map((c) => getDependencyState(c.name));
}

export function isDegraded(): boolean {
  return checkers.some((c) => {
    const state = getDependencyState(c.name);
    return state.status !== "healthy" || state.degradedMode;
  });
}

export function getSystemStatus(): ReliabilityStatus {
  const states = getAllDependencyStates();
  if (states.every((s) => s.status === "healthy")) return "healthy";
  if (states.some((s) => s.status === "unhealthy")) return "unhealthy";
  return "degraded";
}

async function checkWithTimeout(checker: DependencyChecker): Promise<boolean> {
  try {
    const result = await Promise.race([
      checker.check(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error(`${checker.name} check timed out`)), checker.timeoutMs)
      ),
    ]);
    return result;
  } catch {
    return false;
  }
}

export async function checkAllDependencies(): Promise<DependencyState[]> {
  const results = await Promise.allSettled(
    checkers.map(async (checker) => {
      const ok = await checkWithTimeout(checker);
      const existing = depCache.get(checker.name);

      if (ok) {
        const state: DependencyState = {
          name: checker.name,
          status: "healthy",
          lastFailureAt: existing?.lastFailureAt ?? null,
          failureCount: 0,
          degradedMode: false,
        };
        depCache.set(checker.name, state);
      } else {
        const failureCount = (existing?.failureCount ?? 0) + 1;
        const state: DependencyState = {
          name: checker.name,
          status: failureCount >= 3 ? "unhealthy" : "degraded",
          lastFailureAt: Date.now(),
          failureCount,
          degradedMode: true,
        };
        depCache.set(checker.name, state);
      }

      return depCache.get(checker.name)!;
    })
  );

  return results.map((r) => (r.status === "fulfilled" ? r.value : depCache.get("env") ?? {
    name: "unknown",
    status: "unhealthy",
    lastFailureAt: Date.now(),
    failureCount: 999,
    degradedMode: true,
  }));
}

export async function withDependencyCheck<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  const state = getDependencyState(name);
  if (state.status === "unhealthy") {
    return fallback;
  }

  try {
    const result = await fn();
    const existing = depCache.get(name);
    if (existing && existing.failureCount > 0) {
      depCache.set(name, { ...existing, failureCount: 0, status: "healthy", degradedMode: false });
    }
    return result;
  } catch {
    const existing = depCache.get(name) ?? {
      name,
      status: "healthy" as ReliabilityStatus,
      lastFailureAt: null,
      failureCount: 0,
      degradedMode: false,
    };
    const newState: DependencyState = {
      ...existing,
      status: existing.failureCount >= 2 ? "unhealthy" : "degraded",
      lastFailureAt: Date.now(),
      failureCount: existing.failureCount + 1,
      degradedMode: true,
    };
    depCache.set(name, newState);
    return fallback;
  }
}
