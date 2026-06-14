import { describe, it, expect } from "vitest";
import { ConcurrencyGuard } from "@/lib/concurrency-guard";

describe("ConcurrencyGuard", () => {
  it("acquires immediately when under limit", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 5, maxQueueDepth: 10, timeoutMs: 100 });
    const slot = await g.acquire();
    expect(slot.queued).toBe(false);
    expect(g.activeCount).toBe(1);
    slot.release();
    expect(g.activeCount).toBe(0);
  });

  it("queues when at capacity", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 1, maxQueueDepth: 5, timeoutMs: 500 });
    const slot1 = await g.acquire();
    expect(slot1.queued).toBe(false);

    const acquirePromise = g.acquire();
    expect(g.activeCount).toBe(1);
    expect(g.queueDepth).toBe(1);

    slot1.release();
    const slot2 = await acquirePromise;
    expect(slot2.queued).toBe(true);
    expect(slot2.waitMs).toBeGreaterThanOrEqual(0);
    slot2.release();
  });

  it("rejects when queue depth exceeded", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 1, maxQueueDepth: 1, timeoutMs: 500 });
    await g.acquire(); // takes the one slot

    // Fill the queue
    const fillPromise = g.acquire().catch(() => {});

    // This should reject
    await expect(g.acquire()).rejects.toThrow("Concurrency limit exceeded");
  });

  it("times out waiting for slot", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 1, maxQueueDepth: 5, timeoutMs: 50 });
    await g.acquire(); // takes slot
    await expect(g.acquire()).rejects.toThrow("Concurrency timeout");
  });

  it("run() executes function and releases slot", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 1, maxQueueDepth: 5, timeoutMs: 100 });
    const result = await g.run(async () => "hello");
    expect(result).toBe("hello");
    expect(g.activeCount).toBe(0);
  });

  it("run() does not leak slot on throw", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 1, maxQueueDepth: 5, timeoutMs: 100 });
    await expect(g.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(g.activeCount).toBe(0);
  });

  it("reports stats correctly", async () => {
    const g = new ConcurrencyGuard({ name: "test", maxConcurrent: 3, maxQueueDepth: 10, timeoutMs: 100 });
    const slot = await g.acquire();
    const stats = g.stats;
    expect(stats.name).toBe("test");
    expect(stats.active).toBe(1);
    expect(stats.maxConcurrent).toBe(3);
    slot.release();
  });
});
