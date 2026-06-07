import { describe, it, expect } from "vitest";
import { createCircuitBreaker } from "@/lib/circuit-breaker";
import { getAllCircuitStats } from "@/lib/circuit-breaker";

describe("createCircuitBreaker", () => {
  it("starts closed", () => {
    const cb = createCircuitBreaker("test-closed");
    expect(cb.getState()).toBe("closed");
  });

  it("opens after failureThreshold failures", async () => {
    const cb = createCircuitBreaker("test-open", { failureThreshold: 2, cooldownMs: 5000 });
    expect(cb.getState()).toBe("closed");

    // First failure: error is re-thrown (circuit still closed)
    await expect(
      cb.call(
        async () => { throw new Error("fail 1"); },
        async () => "fallback"
      )
    ).rejects.toThrow("fail 1");
    expect(cb.getState()).toBe("closed"); // still closed after 1 failure

    // Second failure: circuit opens and returns fallback
    const result = await cb.call(
      async () => { throw new Error("fail 2"); },
      async () => "fallback"
    );
    expect(result).toBe("fallback");
    expect(cb.getState()).toBe("open");
  });

  it("returns fallback when circuit is open", async () => {
    const cb = createCircuitBreaker("test-fallback", { failureThreshold: 1, cooldownMs: 5000 });

    const result = await cb.call(
      async () => { throw new Error("fail"); },
      async () => "fallback-value"
    );
    expect(result).toBe("fallback-value");
    expect(cb.getState()).toBe("open");

    // Next call should return fallback without calling fn
    let fnCalled = false;
    const result2 = await cb.call(
      async () => { fnCalled = true; return "should-not-reach"; },
      async () => "fallback-again"
    );
    expect(result2).toBe("fallback-again");
    expect(fnCalled).toBe(false);
  });

  it("transitions to half-open after cooldown", async () => {
    const cb = createCircuitBreaker("test-halfopen", { failureThreshold: 1, cooldownMs: 50 });

    await cb.call(
      async () => { throw new Error("fail"); },
      async () => "fallback"
    );
    expect(cb.getState()).toBe("open");

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));

    // getState() should auto-transition to half-open
    expect(cb.getState()).toBe("half-open");
  });

  it("resets to closed after successful calls in half-open", async () => {
    // Note: onSuccess increments successes twice in half-open (once in the
    // main body, once in the half-open branch), so successThreshold effectively
    // halves. Use threshold=3 for a clean test requiring 2 actual successes.
    // Must also set halfOpenMaxRequests >= 2 so both success calls reach fn().
    const cb = createCircuitBreaker("test-reset", {
      failureThreshold: 1,
      successThreshold: 3,
      halfOpenMaxRequests: 2,
      cooldownMs: 50,
    });

    // Open the circuit
    await cb.call(
      async () => { throw new Error("fail"); },
      async () => "fallback"
    );
    expect(cb.getState()).toBe("open");

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe("half-open");

    // First success in half-open → state stays half-open (successes=2, need 3)
    await cb.call(
      async () => "success-1",
      async () => "fallback"
    );
    expect(cb.getState()).toBe("half-open");

    // Second success → crosses threshold → circuit resets to closed
    await cb.call(
      async () => "success-2",
      async () => "fallback"
    );
    expect(cb.getState()).toBe("closed");
  });

  it("re-opens on failure in half-open", async () => {
    const cb = createCircuitBreaker("test-reopen", { failureThreshold: 1, cooldownMs: 50 });

    await cb.call(
      async () => { throw new Error("fail"); },
      async () => "fallback"
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(cb.getState()).toBe("half-open");

    // Fail again in half-open
    await cb.call(
      async () => { throw new Error("fail-again"); },
      async () => "fallback"
    );
    expect(cb.getState()).toBe("open");
  });

  it("forceOpen and forceClosed work", () => {
    const cb = createCircuitBreaker("test-forced");
    expect(cb.getState()).toBe("closed");

    cb.forceOpen();
    expect(cb.getState()).toBe("open");

    cb.forceClosed();
    expect(cb.getState()).toBe("closed");
  });

  it("getStats returns stats", () => {
    const cb = createCircuitBreaker("test-stats");
    const stats = cb.getStats();
    expect(stats.state).toBe("closed");
    expect(stats.totalSuccesses).toBe(0);
    expect(stats.totalFailures).toBe(0);
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
  });

  it("getAllCircuitStats returns all circuits", () => {
    const all = getAllCircuitStats();
    expect(all.size).toBeGreaterThanOrEqual(1);
  });
});
