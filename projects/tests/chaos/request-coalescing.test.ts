import { describe, it, expect, beforeEach } from "vitest";
import { coalesce, getCoalescedKeysCount, clearCoalescedCache } from "@/lib/request-coalescing";

describe("request coalescing", () => {
  beforeEach(() => {
    clearCoalescedCache();
  });

  it("returns same result for concurrent identical keys", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return "result";
    };

    const [r1, r2, r3] = await Promise.all([
      coalesce("key-1", fetcher),
      coalesce("key-1", fetcher),
      coalesce("key-1", fetcher),
    ]);

    expect(r1).toBe("result");
    expect(r2).toBe("result");
    expect(r3).toBe("result");
    expect(callCount).toBe(1); // Only called once
  });

  it("separate keys call fetcher independently", async () => {
    let callCountA = 0;
    let callCountB = 0;

    await Promise.all([
      coalesce("a", async () => { callCountA++; return "A"; }),
      coalesce("b", async () => { callCountB++; return "B"; }),
    ]);

    expect(callCountA).toBe(1);
    expect(callCountB).toBe(1);
  });

  it("reruns fetcher on error", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      if (callCount === 1) throw new Error("first fail");
      return "ok";
    };

    await expect(coalesce("retry-key", fetcher)).rejects.toThrow("first fail");
    // After error, key is removed from cache
    const result = await coalesce("retry-key", fetcher);
    expect(result).toBe("ok");
    expect(callCount).toBe(2);
  });

  it("tracks key count", () => {
    expect(getCoalescedKeysCount()).toBe(0);
  });
});
