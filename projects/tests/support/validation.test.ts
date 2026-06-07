import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Shared mutable Redis store for all tests
const sharedRedisStore = new Map<string, string>();
let redisIncrCounter = 0;
let redisShouldFail = false;

function createRedisMock() {
  return {
    get: vi.fn((key: string) => {
      if (redisShouldFail) return Promise.reject(new Error("Redis fails"));
      return Promise.resolve(sharedRedisStore.get(key) ?? null);
    }),
    set: vi.fn((key: string, val: string, ...args: string[]) => {
      if (redisShouldFail) return Promise.reject(new Error("Redis fails"));
      const nxIndex = args.indexOf("NX");
      if (nxIndex !== -1 && sharedRedisStore.has(key)) {
        return Promise.resolve(null);
      }
      sharedRedisStore.set(key, val);
      return Promise.resolve("OK");
    }),
    setex: vi.fn((key: string, _ttl: number, val: string) => {
      if (redisShouldFail) return Promise.reject(new Error("Redis fails"));
      sharedRedisStore.set(key, val);
      return Promise.resolve("OK");
    }),
    incr: vi.fn((key: string) => {
      if (redisShouldFail) return Promise.reject(new Error("Redis fails"));
      redisIncrCounter++;
      const curr = (Number(sharedRedisStore.get(key)) || 0) + 1;
      sharedRedisStore.set(key, String(curr));
      return Promise.resolve(curr);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    pexpire: vi.fn(() => Promise.resolve(1)),
    sadd: vi.fn(() => Promise.resolve(1)),
    srem: vi.fn(() => Promise.resolve(1)),
    smembers: vi.fn(() => Promise.resolve([])),
    del: vi.fn((key: string) => {
      sharedRedisStore.delete(key);
      return Promise.resolve(1);
    }),
    scan: vi.fn(() => Promise.resolve(["0", []])),
    lpush: vi.fn(() => Promise.resolve(1)),
    ltrim: vi.fn(() => Promise.resolve("OK")),
    lrange: vi.fn(() => Promise.resolve([])),
    publish: vi.fn(() => Promise.resolve(0)),
  };
}

const mockRedisClient = createRedisMock();

vi.mock("@/lib/redis", () => ({
  withRedis: vi.fn(async (fn: (...args: unknown[]) => unknown, fallback: unknown) => {
    try {
      return await fn(mockRedisClient);
    } catch {
      return fallback;
    }
  }),
  isRedisAvailable: vi.fn(() => !redisShouldFail),
  getRedis: vi.fn(),
  cacheGetJson: vi.fn(),
  cacheSetJson: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

const mockSupabaseChain: Record<string, vi.Mock> = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  delete: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  abortSignal: vi.fn().mockReturnThis(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => mockSupabaseChain) })),
  tryCreateAdminClient: vi.fn(() => ({ from: vi.fn(() => mockSupabaseChain) })),
}));

vi.mock("@/lib/event-bus", () => ({
  publishEvent: vi.fn(() => Promise.resolve({ id: "mock-event" })),
}));

vi.mock("@/lib/observability", () => ({
  captureAppError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logFatal: vi.fn(),
  measureAsync: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  securityLog: vi.fn(),
  sanitizePlainText: vi.fn(),
}));

type MockOrder = {
  id?: string;
  order_number: string;
  user_id: string | null;
  customer_phone: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  customer_name: string;
  created_at: string;
  items?: unknown;
  shipping_address?: unknown;
};

function buildMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  return {
    id: "ord-123",
    order_number: "VX-ABCD-1234",
    user_id: "user-456",
    customer_phone: "919999999999",
    order_status: "pending",
    payment_status: "pending",
    payment_method: "cod",
    total: 1500,
    customer_name: "Ravi Kumar",
    created_at: new Date().toISOString(),
    items: [{ title: "Premium Watch", quantity: 1, price: 1500 }],
    shipping_address: { line1: "Test Address" },
    ...overrides,
  };
}

function buildContext(orders: MockOrder[], overrides: Record<string, unknown> = {}) {
  const detailed = orders.map((o) => ({
    orderNumber: o.order_number,
    orderStatus: o.order_status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    total: o.total,
    originalAmount: o.total,
    discountAmount: 0,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    items: (o.items as Array<Record<string, unknown>>) ?? [],
    shippingAddress: (o.shipping_address as Record<string, unknown>) ?? null,
    isCancellable: ["pending", "confirmed"].includes(o.order_status),
    isReturnable: o.order_status === "delivered",
    trackingNumber: null,
    courier: null,
    estimatedDelivery: null,
    imageUrl: "",
    sku: "",
  }));
  return {
    customer: {
      name: "Ravi Kumar",
      email: null,
      phone: "919999999999",
      userId: "user-456",
      isLoggedIn: true,
    },
    orders: detailed,
    activeOrders: detailed.filter((o) => o.orderStatus !== "cancelled"),
    cancelledOrders: detailed.filter((o) => o.orderStatus === "cancelled"),
    refundedOrders: detailed.filter((o) => o.orderStatus === "cancelled" && o.paymentStatus === "refunded"),
    hasActiveOrders: detailed.some((o) => o.orderStatus !== "cancelled"),
    orderCount: detailed.length,
    cart: { itemCount: 0, total: 0, items: [] },
    ...overrides,
  };
}

const DEFAULT_ORDER_RECORD = {
  id: "ord-123",
  order_number: "VX-ABCD-1234",
  user_id: "user-456",
  customer_phone: "919999999999",
};

// ─── Test Group A — Customer Flows ────────────────────────────────────────────

describe("Test Group A — Customer Flows", () => {
  beforeEach(async () => {
    sharedRedisStore.clear();
    redisIncrCounter = 0;
    redisShouldFail = false;
    Object.values(mockSupabaseChain).forEach((m: any) => m.mockClear?.());
    mockSupabaseChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { resetRateLimitMemoryFallback } = await import("@/lib/support/rate-limits");
    resetRateLimitMemoryFallback();
  });

  // A1: Order status flow
  describe("A1: Order status flow", () => {
    it("returns correct status for single active order", async () => {
      const mockOrder = buildMockOrder({ order_status: "shipped" });
      const ctx = buildContext([mockOrder]);
      const { handleOrderStatus } = await import("@/lib/support/executor");
      const result = await handleOrderStatus(ctx);
      expect(result.action).toBe("executed");
      expect(result.data.order.orderStatus).toBe("shipped");
    });

    it("returns not_found when no active orders", async () => {
      const ctx = buildContext([], { hasActiveOrders: false });
      const { handleOrderStatus } = await import("@/lib/support/executor");
      const result = await handleOrderStatus(ctx);
      expect(result.action).toBe("not_found");
    });

    it("shows picker when multiple orders exist", async () => {
      const orders = [
        buildMockOrder({ order_number: "VX-AAAA-0001", order_status: "shipped" }),
        buildMockOrder({ order_number: "VX-BBBB-0002", order_status: "pending" }),
      ];
      const ctx = buildContext(orders);
      const { handleOrderStatus } = await import("@/lib/support/executor");
      const result = await handleOrderStatus(ctx);
      expect(result.action).toBe("needs_selection");
      expect(result.eligibleOrders).toHaveLength(2);
    });

    it("finds order by orderNumber param", async () => {
      const orders = [
        buildMockOrder({ order_number: "VX-AAAA-0001" }),
        buildMockOrder({ order_number: "VX-BBBB-0002" }),
      ];
      const ctx = buildContext(orders);
      const { handleOrderStatus } = await import("@/lib/support/executor");
      const result = await handleOrderStatus(ctx, { orderNumber: "VX-BBBB-0002" });
      expect(result.action).toBe("executed");
      expect(result.data.order.orderNumber).toBe("VX-BBBB-0002");
    });
  });

  // A2: Cancellation flow
  describe("A2: Cancellation flow", () => {
    beforeEach(() => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { ...DEFAULT_ORDER_RECORD },
        error: null,
      });
    });

    it("requires confirmation before executing cancellation", async () => {
      const mockOrder = buildMockOrder({ order_status: "pending" });
      const ctx = buildContext([mockOrder]);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx, { orderNumber: "VX-ABCD-1234" });
      expect(result.action).toBe("awaiting_confirmation");
      expect(result.confirmationRequired).toBe(true);
    });

    it("blocks cancellation for non-eligible order status", async () => {
      const mockOrder = buildMockOrder({ order_status: "shipped" });
      const ctx = buildContext([mockOrder]);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx, { orderNumber: "VX-ABCD-1234", confirmed: true });
      expect(result.action).toBe("not_eligible");
    });

    it("rejects cancellation for phone mismatch via authorization", async () => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { id: "ord-123", order_number: "VX-ABCD-1234", customer_phone: "918888888888", user_id: "user-456" },
        error: null,
      });

      const orders = [buildMockOrder({ order_status: "pending", customer_phone: "918888888888" })];
      const ctx = buildContext(orders);
      ctx.customer.phone = "919999999999";

      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        context: ctx,
      });
      expect(result.authorized).toBe(false);
    });

    it("shows order picker when multiple cancellable orders exist", async () => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { id: "ord-111", order_number: "VX-AAAA-0001", customer_phone: "919999999999", user_id: "user-456" },
        error: null,
      });

      const orders = [
        buildMockOrder({ id: "ord-111", order_number: "VX-AAAA-0001", order_status: "pending" }),
        buildMockOrder({ id: "ord-222", order_number: "VX-BBBB-0002", order_status: "confirmed" }),
      ];
      const ctx = buildContext(orders);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx);
      expect(result.action).toBe("needs_selection");
      expect(result.eligibleOrders).toHaveLength(2);
    });

    it("returns not_eligible when no cancellable orders", async () => {
      const orders = [
        buildMockOrder({ order_number: "VX-AAAA-0001", order_status: "shipped" }),
        buildMockOrder({ order_number: "VX-BBBB-0002", order_status: "delivered" }),
      ];
      const ctx = buildContext(orders);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx);
      expect(result.action).toBe("not_eligible");
    });
  });

  // A3: Refund flow
  describe("A3: Refund flow", () => {
    beforeEach(() => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { ...DEFAULT_ORDER_RECORD },
        error: null,
      });
    });

    it("requires confirmation before executing refund", async () => {
      const mockOrder = buildMockOrder({
        order_status: "delivered",
        payment_status: "paid",
        payment_method: "online",
      });
      const ctx = buildContext([mockOrder]);
      const { handleRefund } = await import("@/lib/support/executor");
      const result = await handleRefund(ctx, { orderNumber: "VX-ABCD-1234" });
      expect(result.confirmationRequired).toBe(true);
    });

    it("rejects refund for unpaid orders", async () => {
      const mockOrder = buildMockOrder({
        order_status: "delivered",
        payment_status: "pending",
      });
      const ctx = buildContext([mockOrder]);
      const { handleRefund } = await import("@/lib/support/executor");
      const result = await handleRefund(ctx, { orderNumber: "VX-ABCD-1234", confirmed: true });
      expect(result.action).toBe("not_eligible");
    });

    it("rejects refund for undelivered orders", async () => {
      const mockOrder = buildMockOrder({
        order_status: "pending",
        payment_status: "paid",
      });
      const ctx = buildContext([mockOrder]);
      const { handleRefund } = await import("@/lib/support/executor");
      const result = await handleRefund(ctx, { orderNumber: "VX-ABCD-1234", confirmed: true });
      expect(result.action).toBe("not_eligible");
    });
  });

  // A4: Multi-order flow
  describe("A4: Multi-order flow", () => {
    beforeEach(() => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { ...DEFAULT_ORDER_RECORD },
        error: null,
      });
    });

    it("shows picker with 3+ orders", async () => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { id: "ord-111", order_number: "VX-AAAA-0001", customer_phone: "919999999999", user_id: "user-456" },
        error: null,
      });

      const orders = [
        buildMockOrder({ id: "ord-111", order_number: "VX-AAAA-0001", order_status: "pending" }),
        buildMockOrder({ id: "ord-222", order_number: "VX-BBBB-0002", order_status: "confirmed" }),
        buildMockOrder({ id: "ord-333", order_number: "VX-CCCC-0003", order_status: "pending" }),
      ];
      const ctx = buildContext(orders);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx);
      expect(result.action).toBe("needs_selection");
      expect(result.eligibleOrders).toHaveLength(3);
    });

    it("executes on selected order only when orderNumber provided", async () => {
      const orders = [
        buildMockOrder({ order_number: "VX-AAAA-0001", order_status: "pending" }),
        buildMockOrder({ order_number: "VX-BBBB-0002", order_status: "confirmed" }),
      ];
      const ctx = buildContext(orders);
      const { handleCancelOrder } = await import("@/lib/support/executor");
      const result = await handleCancelOrder(ctx, { orderNumber: "VX-BBBB-0002" });
      expect(result.confirmationDetails?.orderNumber).toBe("VX-BBBB-0002");
    });
  });

  // A5: Unauthorized flow
  describe("A5: Unauthorized flow", () => {
    it("rejects access with wrong phone number", async () => {
      mockSupabaseChain.maybeSingle.mockResolvedValue({
        data: { id: "ord-123", order_number: "VX-ABCD-1234", customer_phone: "918888888888", user_id: "user-456" },
        error: null,
      });

      const orders = [buildMockOrder({ order_status: "pending", customer_phone: "918888888888" })];
      const ctx = buildContext(orders);
      ctx.customer.phone = "919999999999";
      ctx.customer.userId = "user-hacker";

      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        context: ctx,
      });
      expect(result.authorized).toBe(false);
    });

    it("non-destructive intents bypass authorization", async () => {
      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "order_status",
        orderNumber: "VX-ABCD-1234",
        context: null as never,
      });
      expect(result.authorized).toBe(true);
      expect(result.code).toBe("non_destructive");
    });
  });
});

// ─── Test Group B — Failure Scenarios ─────────────────────────────────────────

describe("Test Group B — Failure Scenarios", () => {
  beforeEach(async () => {
    sharedRedisStore.clear();
    redisIncrCounter = 0;
    redisShouldFail = false;
    Object.values(mockSupabaseChain).forEach((m: any) => m.mockClear?.());
    mockSupabaseChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { resetRateLimitMemoryFallback } = await import("@/lib/support/rate-limits");
    resetRateLimitMemoryFallback();
  });

  // B1: Database offline
  describe("B1: Database offline", () => {
    it("blocks destructive actions when verification fails", async () => {
      mockSupabaseChain.maybeSingle.mockRejectedValue(new Error("DB connection failed"));

      const orders = [buildMockOrder({ order_status: "pending" })];
      const ctx = buildContext(orders);

      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        context: ctx,
      });
      expect(result.authorized).toBe(false);
      expect(result.code).toBe("service_unavailable");
    });

    it("non-destructive intents bypass authorization check", async () => {
      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "order_status",
        orderNumber: "VX-ABCD-1234",
        context: null as never,
      });
      expect(result.authorized).toBe(true);
    });
  });

  // B2: Redis offline
  describe("B2: Redis offline", () => {
    it("rate limits fall back to memory when Redis fails", async () => {
      redisShouldFail = true;
      const { checkSupportRateLimit } = await import("@/lib/support/rate-limits");
      const result = await checkSupportRateLimit("cancel", "919999999999");
      expect(result.allowed).toBe(true);
    });

    it("fraud detection handles Redis failure gracefully", async () => {
      redisShouldFail = true;
      const { assessFraudRisk } = await import("@/lib/support/fraud-detection");
      const ctx = buildContext([buildMockOrder()]);
      let threw = false;
      try {
        await assessFraudRisk("cancel_order", ctx);
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  });

  // B3: Context unavailable
  describe("B3: Context unavailable", () => {
    it("order status returns not_found with empty context", async () => {
      const ctx = buildContext([], {
        hasActiveOrders: false,
        orderCount: 0,
        customer: { name: null, email: null, phone: null, userId: null, isLoggedIn: false },
      });
      const { handleOrderStatus } = await import("@/lib/support/executor");
      const result = await handleOrderStatus(ctx);
      expect(result.action).toBe("not_found");
    });

    it("destructive action blocked with missing context identifiers", async () => {
      const emptyCtx = buildContext([]);
      emptyCtx.customer.phone = null;
      emptyCtx.customer.userId = null;

      const auth = await import("@/lib/support/authorization");
      const result = await auth.authorizeDestructiveAction({
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        context: emptyCtx,
      });
      expect(result.authorized).toBe(false);
    });
  });

  // B4: Expired confirmation
  describe("B4: Expired confirmation", () => {
    it("rejects expired confirmation", async () => {
      sharedRedisStore.set("support:confirmation:expired-id", JSON.stringify({
        id: "expired-id",
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        customerPhone: "919999999999",
        customerUserId: null,
        data: {},
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        confirmed: false,
        executed: false,
      }));

      const { confirmPendingConfirmation } = await import("@/lib/support/session-manager");
      const result = await confirmPendingConfirmation("expired-id");
      expect(result.success).toBe(false);
      expect(result.reason).toContain("expired");
    });
  });

  // B5: Duplicate YES
  describe("B5: Duplicate YES", () => {
    it("detects duplicate confirmations via idempotency", async () => {
      sharedRedisStore.set("support:idempotency:dup-id", JSON.stringify({
        status: "completed",
        result: { action: "executed" },
        processedAt: new Date().toISOString(),
      }));

      const { checkIdempotency } = await import("@/lib/support/idempotency");
      const result = await checkIdempotency("dup-id");
      expect(result.isDuplicate).toBe(true);
      expect(result.shouldProceed).toBe(false);
    });

    it("prevents reprocessing same order+intent combination", async () => {
      const { isOrderConfirmationProcessed, markOrderConfirmationProcessed } = await import("@/lib/support/idempotency");
      const before = await isOrderConfirmationProcessed("VX-ABCD-1234", "cancel_order");
      expect(before).toBe(false);

      await markOrderConfirmationProcessed("VX-ABCD-1234", "cancel_order");

      const after = await isOrderConfirmationProcessed("VX-ABCD-1234", "cancel_order");
      expect(after).toBe(true);
    });
  });

  // B6: High traffic spam
  describe("B6: High traffic spam", () => {
    it("rate limiter blocks after exceeding limit", async () => {
      const { checkSupportRateLimit } = await import("@/lib/support/rate-limits");
      for (let i = 0; i < 3; i++) {
        const result = await checkSupportRateLimit("cancel", "919999999999");
        expect(result.allowed).toBe(true);
      }
      const blocked = await checkSupportRateLimit("cancel", "919999999999");
      expect(blocked.allowed).toBe(false);
    });

    it("fraud detection flags excessive cancellations", async () => {
      const { trackAction, assessFraudRisk } = await import("@/lib/support/fraud-detection");
      for (let i = 0; i < 5; i++) {
        await trackAction("919999999999", "cancel");
      }

      const ctx = buildContext([buildMockOrder()]);
      const fraudResult = await assessFraudRisk("cancel_order", ctx);
      expect(fraudResult.flags).toContain("excessive_cancellations");
    });
  });
});

// ─── Test Group C — WhatsApp Production Pipeline ──────────────────────────────

describe("Test Group C — WhatsApp Production Pipeline", () => {
  it("detects cancel intent from message text", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.detectIntent("cancel my order")).toContain("cancel");
  });

  it("detects order status intent", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.detectIntent("where is my order")).toContain("order_status");
  });

  it("detects refund intent", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.detectIntent("refund my money")).toContain("refund");
  });

  it("detects return intent", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.detectIntent("I want to return my order")).toContain("refund");
  });

  it("analyzes emotion correctly for urgent", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.analyzeEmotion("this is urgent please help")).toBe("urgent");
  });

  it("analyzes emotion correctly for neutral", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.analyzeEmotion("hello")).toBe("neutral");
  });

  it("analyzes emotion correctly for confused", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.analyzeEmotion("I'm confused about my order")).toBe("confused");
  });

  it("does not false-positive 'help' as confused in positive context", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.analyzeEmotion("thanks for the help")).toBe("happy");
    expect(intelligence.analyzeEmotion("thanks for your help!")).toBe("happy");
  });

  it("detects multiple intents in single message", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    const intents = intelligence.detectIntent("cancel my order and refund the money");
    expect(intents).toContain("cancel");
    expect(intents).toContain("refund");
  });

  it("handles out-of-domain query gracefully", async () => {
    const intelligence = await import("@/lib/whatsapp/intelligence");
    expect(intelligence.detectIntent("what is the weather today")).toEqual(["unknown"]);
  });
});

// ─── Support Security Layer Unit Tests ────────────────────────────────────────

describe("Support Security Layer — Unit Tests", () => {
  beforeEach(async () => {
    sharedRedisStore.clear();
    redisIncrCounter = 0;
    redisShouldFail = false;
    const { resetRateLimitMemoryFallback } = await import("@/lib/support/rate-limits");
    resetRateLimitMemoryFallback();
  });

  describe("authorization.ts", () => {
    it("correctly identifies destructive intents", async () => {
      const { isDestructiveIntent } = await import("@/lib/support/authorization");
      expect(isDestructiveIntent("cancel_order")).toBe(true);
      expect(isDestructiveIntent("refund")).toBe(true);
      expect(isDestructiveIntent("return_order")).toBe(true);
      expect(isDestructiveIntent("replace_order")).toBe(true);
      expect(isDestructiveIntent("order_status")).toBe(false);
      expect(isDestructiveIntent("tracking")).toBe(false);
    });
  });

  describe("idempotency.ts", () => {
    it("generates unique action IDs", async () => {
      const { generateActionId } = await import("@/lib/support/idempotency");
      const id1 = generateActionId();
      const id2 = generateActionId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^act-/);
    });
  });

  describe("rate-limits.ts", () => {
    it("different categories have independent limits", async () => {
      const { checkSupportRateLimit } = await import("@/lib/support/rate-limits");
      const cancelResult = await checkSupportRateLimit("cancel", "919999999991");
      expect(cancelResult.allowed).toBe(true);
      const refundResult = await checkSupportRateLimit("refund", "919999999991");
      expect(refundResult.allowed).toBe(true);
    });
  });

  describe("fraud-detection.ts", () => {
    it("non-fraudulent activity passes assessment", async () => {
      const { assessFraudRisk } = await import("@/lib/support/fraud-detection");
      const ctx = buildContext([buildMockOrder()]);
      const result = await assessFraudRisk("order_status", ctx);
      expect(result.flagged).toBe(false);
      expect(result.action).toBe("allow");
    });
  });

  describe("session-manager.ts", () => {
    it("creates and retrieves pending confirmations", async () => {
      const { createPendingConfirmation, getPendingConfirmation } = await import("@/lib/support/session-manager");
      const created = await createPendingConfirmation({
        intent: "cancel_order",
        orderNumber: "VX-ABCD-1234",
        customerPhone: "919999999999",
      });
      expect(created.id).toBeDefined();
      expect(created.intent).toBe("cancel_order");

      const retrieved = await getPendingConfirmation(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.orderNumber).toBe("VX-ABCD-1234");
    });
  });

  describe("emergency-fallback.ts", () => {
    it("returns status object with all fields", async () => {
      const { getEmergencyStatus, resetCachedStatus } = await import("@/lib/support/emergency-fallback");
      resetCachedStatus();
      const status = await getEmergencyStatus(true);
      expect(status).toHaveProperty("destructiveActionsDisabled");
      expect(status).toHaveProperty("dbAvailable");
      expect(status).toHaveProperty("contextAvailable");
      expect(status).toHaveProperty("lastChecked");
      expect(status).toHaveProperty("reason");
    });
  });
});
