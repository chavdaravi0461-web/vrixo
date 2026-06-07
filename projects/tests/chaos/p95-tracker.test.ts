import { describe, it, expect } from "vitest";
import { P95Tracker } from "@/lib/p95-tracker";

describe("P95Tracker", () => {
  it("records single sample correctly", () => {
    const t = new P95Tracker("test", 100);
    t.record(10);
    t.record(20);
    t.record(30);
    const s = t.snapshot();
    expect(s.name).toBe("test");
    expect(s.count).toBe(3);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(30);
    expect(s.avgMs).toBe(20);
  });

  it("calculates percentiles correctly", () => {
    const t = new P95Tracker("test", 100);
    for (let i = 0; i < 100; i++) {
      t.record(i + 1);
    }
    const s = t.snapshot();
    expect(s.count).toBe(100);
    expect(s.p50Ms).toBe(50);
    expect(s.p95Ms).toBe(95);
    expect(s.p99Ms).toBe(99);
  });

  it("start() stop() measures duration", () => {
    const t = new P95Tracker("test", 100);
    const stop = t.start();
    // synchronous wait
    for (let i = 0; i < 1000000; i++) {
      Math.sqrt(i);
    }
    stop();
    const s = t.snapshot();
    expect(s.count).toBe(1);
    expect(s.avgMs).toBeGreaterThan(0);
  });

  it("handles empty snapshot", () => {
    const t = new P95Tracker("empty", 100);
    const s = t.snapshot();
    expect(s.count).toBe(0);
    expect(s.avgMs).toBe(0);
    expect(s.minMs).toBe(0);
    expect(s.maxMs).toBe(0);
  });

  it("log does not throw", () => {
    const t = new P95Tracker("test", 100);
    t.record(42);
    expect(() => t.log()).not.toThrow();
  });
});
