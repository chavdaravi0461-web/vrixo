import "server-only";

type CircuitState = "closed" | "open" | "half-open";

interface CircuitConfig {
  failureThreshold: number;
  successThreshold: number;
  cooldownMs: number;
  halfOpenMaxRequests: number;
  name: string;
}

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  halfOpenAttempts: number;
  totalFailures: number;
  totalSuccesses: number;
}

const circuits = new Map<string, CircuitData>();

interface CircuitData {
  config: CircuitConfig;
  failures: number;
  successes: number;
  state: CircuitState;
  lastFailureAt: number;
  lastSuccessAt: number;
  openedAt: number;
  halfOpenAttempts: number;
  totalFailures: number;
  totalSuccesses: number;
}

export function createCircuitBreaker(name: string, overrides?: Partial<CircuitConfig>): CircuitBreaker {
  const config: CircuitConfig = {
    failureThreshold: overrides?.failureThreshold ?? 5,
    successThreshold: overrides?.successThreshold ?? 3,
    cooldownMs: overrides?.cooldownMs ?? 30_000,
    halfOpenMaxRequests: overrides?.halfOpenMaxRequests ?? 1,
    name: name,
    ...overrides,
  };

  if (!circuits.has(name)) {
    circuits.set(name, {
      config,
      failures: 0,
      successes: 0,
      state: "closed",
      lastFailureAt: 0,
      lastSuccessAt: 0,
      openedAt: 0,
      halfOpenAttempts: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    });
  }

  const state = circuits.get(name)!;

  function getState(): CircuitState {
    if (state.state === "open") {
      if (Date.now() - state.openedAt >= config.cooldownMs) {
        state.state = "half-open";
        state.halfOpenAttempts = 0;
      }
    }
    return state.state;
  }

  async function call<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    const currentState = getState();

    if (currentState === "open") {
      return fallback();
    }

    if (currentState === "half-open") {
      if (state.halfOpenAttempts >= config.halfOpenMaxRequests) {
        return fallback();
      }
      state.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      if (getState() === "open") {
        return fallback();
      }
      throw error;
    }
  }

  function onSuccess(): void {
    state.successes++;
    state.totalSuccesses++;
    state.lastSuccessAt = Date.now();

    if (state.state === "half-open") {
      state.successes++;
      if (state.successes >= config.successThreshold) {
        reset();
      }
    } else {
      state.failures = 0;
    }
  }

  function onFailure(): void {
    state.failures++;
    state.totalFailures++;
    state.lastFailureAt = Date.now();

    if (state.state === "half-open") {
      state.state = "open";
      state.openedAt = Date.now();
      state.failures = 1;
      state.successes = 0;
    } else if (state.failures >= config.failureThreshold) {
      state.state = "open";
      state.openedAt = Date.now();
    }
  }

  function reset(): void {
    state.state = "closed";
    state.failures = 0;
    state.successes = 0;
    state.halfOpenAttempts = 0;
  }

  function forceOpen(): void {
    state.state = "open";
    state.openedAt = Date.now();
  }

  function forceClosed(): void {
    reset();
  }

  function getStats(): CircuitStats {
    return {
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      lastFailureAt: state.lastFailureAt || null,
      lastSuccessAt: state.lastSuccessAt || null,
      openedAt: state.openedAt || null,
      halfOpenAttempts: state.halfOpenAttempts,
      totalFailures: state.totalFailures,
      totalSuccesses: state.totalSuccesses,
    };
  }

  return { call, getState: () => getState(), getStats, forceOpen, forceClosed, reset, name: config.name };
}

export interface CircuitBreaker {
  call: <T>(fn: () => Promise<T>, fallback: () => Promise<T>) => Promise<T>;
  getState: () => CircuitState;
  getStats: () => CircuitStats;
  forceOpen: () => void;
  forceClosed: () => void;
  reset: () => void;
  name: string;
}

export function getAllCircuitStats(): Map<string, CircuitStats> {
  const result = new Map<string, CircuitStats>();
  for (const [name, data] of circuits) {
    result.set(name, {
      state: data.state,
      failures: data.failures,
      successes: data.successes,
      lastFailureAt: data.lastFailureAt || null,
      lastSuccessAt: data.lastSuccessAt || null,
      openedAt: data.openedAt || null,
      halfOpenAttempts: data.halfOpenAttempts,
      totalFailures: data.totalFailures,
      totalSuccesses: data.totalSuccesses,
    });
  }
  return result;
}
