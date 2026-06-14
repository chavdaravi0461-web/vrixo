import { describe, it, expect } from "vitest";
import {
  recordFailure,
  getFailureReport,
  getFailureCount,
  getTotalFailureCount,
} from "@/lib/failure-metrics";

describe("failure metrics", () => {
  it("records and reports failures", () => {
    const supabaseBefore = getFailureCount("supabase");
    recordFailure("supabase", "timeout");
    recordFailure("supabase", "connection_refused");
    recordFailure("whatsapp", "rate_limited");

    expect(getFailureCount("supabase")).toBe(supabaseBefore + 2);
  });

  it("aggregates same category and reason", () => {
    const supabaseBefore = getFailureCount("supabase");
    recordFailure("supabase", "timeout");
    recordFailure("supabase", "timeout");
    expect(getFailureCount("supabase")).toBe(supabaseBefore + 2);
  });

  it("count by category", () => {
    const redisBefore = getFailureCount("redis");
    recordFailure("redis", "connection_lost");
    recordFailure("redis", "connection_lost");
    recordFailure("redis", "timeout");
    expect(getFailureCount("redis")).toBe(redisBefore + 3);
  });

  it("total count across all categories", () => {
    const before = getTotalFailureCount();
    recordFailure("cache", "miss");
    expect(getTotalFailureCount()).toBe(before + 1);
  });
});
