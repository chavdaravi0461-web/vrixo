import { describe, it, expect } from "vitest";

describe("NullSupabaseClient Reliability", () => {
  it("should never throw when env vars are missing", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const client = createAdminClient();
    expect(client).toBeDefined();
  });
});

describe("SafeRoute Reliability", () => {
  it("should catch thrown errors and return 503 for recoverable errors", async () => {
    const { safeRoute } = await import("@/lib/safe-route");
    const handler = safeRoute(async () => {
      throw new Error("Supabase connection timeout");
    });
    const response = await handler(new Request("http://localhost/api/test"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.requestId).toBeDefined();
    expect(body.retryAfter).toBe(5);
  });

  it("should catch thrown errors and return 500 for non-recoverable errors", async () => {
    const { safeRoute } = await import("@/lib/safe-route");
    const handler = safeRoute(async () => {
      throw new Error("Invalid order data");
    });
    const response = await handler(new Request("http://localhost/api/test"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.requestId).toBeDefined();
  });

  it("should preserve x-request-id from incoming request", async () => {
    const { safeRoute } = await import("@/lib/safe-route");
    const handler = safeRoute(async (req) => {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ ok: true });
    });
    const request = new Request("http://localhost/api/test", {
      headers: { "x-request-id": "test-request-123" },
    });
    const response = await handler(request);
    expect(response.headers.get("x-request-id")).toBe("test-request-123");
  });
});

describe("Reliability Types", () => {
  it("should classify timeout errors as recoverable", async () => {
    const { classifyError } = await import("@/lib/reliability-types");
    const result = classifyError(new Error("Request timed out after 10s"));
    expect(result.type).toBe("timeout");
    expect(result.recoverable).toBe(true);
  });

  it("should classify Supabase errors as dependency errors", async () => {
    const { classifyError } = await import("@/lib/reliability-types");
    const result = classifyError(new Error("Supabase query failed: connection refused"));
    expect(result.type).toBe("dependency");
    expect(result.recoverable).toBe(true);
  });

  it("should classify validation errors as non-recoverable", async () => {
    const { classifyError } = await import("@/lib/reliability-types");
    const result = classifyError(new Error("Validation failed: order number is required"));
    expect(result.type).toBe("validation");
    expect(result.recoverable).toBe(false);
  });

  it("safeSuccess should produce correct shape", async () => {
    const { safeSuccess } = await import("@/lib/reliability-types");
    const result = safeSuccess({ orderId: "123" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ orderId: "123" });
    expect(result.error).toBeNull();
    expect(result.degraded).toBe(false);
  });

  it("safeError should produce correct shape", async () => {
    const { safeError } = await import("@/lib/reliability-types");
    const result = safeError("Database unavailable");
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toBe("Database unavailable");
    expect(result.degraded).toBe(true);
  });
});
