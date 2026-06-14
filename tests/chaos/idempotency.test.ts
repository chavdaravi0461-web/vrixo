import { describe, it, expect, beforeEach } from "vitest";
import { IdempotencyGuard } from "@/lib/idempotency";

describe("IdempotencyGuard", () => {
  let guard: IdempotencyGuard;

  beforeEach(() => {
    guard = new IdempotencyGuard("test", 3600, 1000);
  });

  it("first caller gets not duplicate", async () => {
    const result = await guard.acquire("req-1");
    expect(result.isDuplicate).toBe(false);
    expect(result.previousResult).toBeNull();
  });

  it("second caller with same key gets duplicate with completed result", async () => {
    const first = await guard.acquire("req-1");
    first.commit("done");

    const second = await guard.acquire("req-1");
    expect(second.isDuplicate).toBe(true);
    expect(second.previousResult).toBe("done");
  });

  it("different keys are independent", async () => {
    const r1 = await guard.acquire("req-1");
    const r2 = await guard.acquire("req-2");
    expect(r1.isDuplicate).toBe(false);
    expect(r2.isDuplicate).toBe(false);

    r1.commit("one");
    r2.commit("two");

    const r1again = await guard.acquire("req-1");
    expect(r1again.previousResult).toBe("one");

    const r2again = await guard.acquire("req-2");
    expect(r2again.previousResult).toBe("two");
  });

  it("reports stats", () => {
    const stats = guard.getStats();
    expect(stats.name).toBe("test");
    expect(stats.keys).toBe(0);
    expect(stats.maxKeys).toBe(1000);
  });
});
