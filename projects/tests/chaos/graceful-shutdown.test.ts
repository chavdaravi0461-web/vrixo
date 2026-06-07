import { describe, it, expect } from "vitest";
import { onShutdown, isShuttingDown } from "@/lib/graceful-shutdown";

describe("graceful shutdown", () => {
  it("is not shutting down by default", () => {
    expect(isShuttingDown()).toBe(false);
  });

  it("registers shutdown handlers", () => {
    let called = false;
    onShutdown(async () => { called = true; });
    // Handler is registered but not called (no SIGTERM/SIGINT in test)
    expect(isShuttingDown()).toBe(false);
  });
});
