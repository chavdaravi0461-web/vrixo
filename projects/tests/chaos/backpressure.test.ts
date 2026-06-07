import { describe, it, expect, beforeEach } from "vitest";
import {
  reportEventBufferDepth,
  reportQueueDepth,
  reportConcurrency,
  assessBackpressure,
  isOverloaded,
  getBackpressureLevel,
} from "@/lib/backpressure";

describe("backpressure", () => {
  beforeEach(() => {
    reportEventBufferDepth(0);
    reportQueueDepth(0);
  });

  it("returns none when all clear", () => {
    const r = assessBackpressure();
    expect(r.level).toBe("none");
    expect(r.reasons).toEqual([]);
  });

  it("detects high event buffer", () => {
    reportEventBufferDepth(250);
    const r = assessBackpressure();
    expect(r.level).toBe("light");
    expect(r.reasons.some((x) => x.includes("event_buffer_high"))).toBe(true);
  });

  it("detects critical event buffer", () => {
    reportEventBufferDepth(500);
    const r = assessBackpressure();
    expect(r.level).toBe("critical");
  });

  it("detects high queue depth", () => {
    reportQueueDepth(100);
    const r = assessBackpressure();
    expect(r.level).toBe("light");
  });

  it("detects multiple issues as moderate", () => {
    reportEventBufferDepth(250);
    reportQueueDepth(100);
    const r = assessBackpressure();
    expect(r.level).toBe("moderate");
  });

  it("isOverloaded returns true for critical", () => {
    reportEventBufferDepth(500);
    expect(isOverloaded()).toBe(true);
  });

  it("isOverloaded returns false for light", () => {
    reportEventBufferDepth(250);
    expect(isOverloaded()).toBe(false);
  });

  it("getBackpressureLevel returns level string", () => {
    expect(getBackpressureLevel()).toBe("none");
    reportQueueDepth(300);
    expect(getBackpressureLevel()).toBe("critical");
  });

  it("resets when metrics clear", () => {
    reportQueueDepth(300);
    expect(getBackpressureLevel()).toBe("critical");
    reportQueueDepth(0);
    // Still critical because eventBufferDepth wasn't reset — but we already reset it in beforeEach
    expect(getBackpressureLevel()).toBe("none");
  });
});
