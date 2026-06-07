import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";
import { publishEvent } from "@/lib/event-bus";
import { executeWithLock } from "@/lib/distributed-lock";

export type PaymentProvider = "razorpay" | "stripe" | "cod";
export type PaymentStatus = "pending" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded";
export type PaymentAction = "create" | "verify" | "capture" | "refund" | "void";

export interface PaymentRequest {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  orderId: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}

export interface PaymentResponse {
  success: boolean;
  providerPaymentId?: string;
  providerOrderId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  error?: string;
  providerRaw?: Record<string, unknown>;
}

interface LedgerEntry {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  action: PaymentAction;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  idempotencyKey: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  error: string | null;
  traceId: string;
  createdAt: string;
}

const LEDGER_CACHE_PREFIX = "ledger:";
const IDEMPOTENCY_CACHE_TTL = 86400 * 7;

export class PaymentOrchestrator {
  async createPayment(req: PaymentRequest): Promise<PaymentResponse> {
    const existing = await this.checkIdempotency(req.idempotencyKey);
    if (existing) {
      logInfo("payment.idempotent_replay", { idempotencyKey: req.idempotencyKey, orderId: req.orderId });
      return existing;
    }

    const lockResult = await executeWithLock(
      `payment:${req.orderId}`,
      async () => {
        const result = await this.routeCreate(req);
        await this.recordLedger({
          orderId: req.orderId,
          provider: req.provider,
          action: "create",
          amount: req.amount,
          currency: req.currency,
          status: result.success ? "pending" : "failed",
          providerPaymentId: result.providerPaymentId ?? null,
          providerOrderId: result.providerOrderId ?? null,
          idempotencyKey: req.idempotencyKey,
          requestPayload: req as unknown as Record<string, unknown>,
          responsePayload: result as unknown as Record<string, unknown>,
          error: result.error ?? null,
        });

        if (result.success) {
          await this.cacheIdempotency(req.idempotencyKey, result);
        }

        return result;
      },
      { ttlSeconds: 30, retryCount: 3 },
    );

    if (!lockResult.success) {
      return { success: false, status: "failed", amount: req.amount, currency: req.currency, error: lockResult.error };
    }

    return lockResult.data;
  }

  async capturePayment(
    provider: PaymentProvider,
    providerPaymentId: string,
    amount: number,
    orderId: string,
    idempotencyKey: string,
  ): Promise<PaymentResponse> {
    const existing = await this.checkIdempotency(idempotencyKey);
    if (existing) return existing;

    const result = await this.routeCapture(provider, providerPaymentId, amount);

    await this.recordLedger({
      orderId,
      provider,
      action: "capture",
      amount,
      currency: "INR",
      status: result.success ? "captured" : "failed",
      providerPaymentId,
      providerOrderId: result.providerOrderId ?? null,
      idempotencyKey,
      requestPayload: { provider, providerPaymentId, amount },
      responsePayload: result as unknown as Record<string, unknown>,
      error: result.error ?? null,
    });

    if (result.success) {
      await this.cacheIdempotency(idempotencyKey, result);
      await publishEvent({
        type: "payment.captured",
        severity: "info",
        entityId: orderId,
        entityType: "order",
        payload: { provider, providerPaymentId, amount, traceId: getTraceId() },
      });
    }

    return result;
  }

  async refundPayment(
    provider: PaymentProvider,
    providerPaymentId: string,
    amount: number,
    orderId: string,
    idempotencyKey: string,
  ): Promise<PaymentResponse> {
    const existing = await this.checkIdempotency(idempotencyKey);
    if (existing) return existing;

    const result = await this.routeRefund(provider, providerPaymentId, amount);

    await this.recordLedger({
      orderId,
      provider,
      action: "refund",
      amount,
      currency: "INR",
      status: result.success ? "refunded" : "failed",
      providerPaymentId,
      providerOrderId: result.providerOrderId ?? null,
      idempotencyKey,
      requestPayload: { provider, providerPaymentId, amount },
      responsePayload: result as unknown as Record<string, unknown>,
      error: result.error ?? null,
    });

    if (result.success) {
      await this.cacheIdempotency(idempotencyKey, result);
    }

    return result;
  }

  async getPaymentLedger(orderId: string): Promise<LedgerEntry[]> {
    const cached = await withRedis(async (redis) => {
      const raw = await redis.lrange(`${LEDGER_CACHE_PREFIX}${orderId}`, 0, -1);
      return raw.map((r) => JSON.parse(r) as LedgerEntry);
    }, [] as LedgerEntry[]);

    if (cached.length > 0) return cached;

    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("app_events")
        .select("id, type, entity_id, entity_type, payload, created_at")
        .eq("entity_type", "payment")
        .eq("entity_id", orderId)
        .like("type", "payment.%")
        .order("created_at", { ascending: true })
        .limit(500);

      if (error || !data) return [];

      return data
        .filter((r) => r.payload && typeof r.payload === "object")
        .map((r) => {
          const p = r.payload as Record<string, unknown>;
          return {
            id: r.id,
            orderId: String(p.orderId ?? r.entity_id),
            provider: String(p.provider ?? "unknown") as PaymentProvider,
            action: String(p.action ?? "unknown") as PaymentAction,
            amount: Number(p.amount ?? 0),
            currency: String(p.currency ?? "INR"),
            status: String(p.status ?? "unknown") as PaymentStatus,
            providerPaymentId: (p.providerPaymentId as string) ?? null,
            providerOrderId: (p.providerOrderId as string) ?? null,
            idempotencyKey: String(p.idempotencyKey ?? ""),
            requestPayload: (p.requestPayload as Record<string, unknown>) ?? {},
            responsePayload: (p.responsePayload as Record<string, unknown>) ?? null,
            error: (p.error as string) ?? null,
            traceId: String(p.traceId ?? ""),
            createdAt: r.created_at,
          } as LedgerEntry;
        });
    } catch {
      return [];
    }
  }

  private async routeCreate(req: PaymentRequest): Promise<PaymentResponse> {
    switch (req.provider) {
      case "razorpay":
        return this.createRazorpayOrder(req);
      case "cod":
        return { success: true, status: "pending", amount: req.amount, currency: req.currency };
      default:
        return { success: false, status: "failed", amount: req.amount, currency: req.currency, error: `Unsupported provider: ${req.provider}` };
    }
  }

  private async routeCapture(provider: PaymentProvider, paymentId: string, amount: number): Promise<PaymentResponse> {
    switch (provider) {
      case "razorpay":
        return this.captureRazorpayPayment(paymentId, amount);
      default:
        return { success: false, status: "failed", amount, currency: "INR", error: `Capture not supported for ${provider}` };
    }
  }

  private async routeRefund(provider: PaymentProvider, paymentId: string, amount: number): Promise<PaymentResponse> {
    switch (provider) {
      case "razorpay":
        return this.refundRazorpayPayment(paymentId, amount);
      default:
        return { success: false, status: "failed", amount, currency: "INR", error: `Refund not supported for ${provider}` };
    }
  }

  private async createRazorpayOrder(req: PaymentRequest): Promise<PaymentResponse> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { success: false, status: "failed", amount: req.amount, currency: req.currency, error: "Razorpay not configured" };
    }

    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(req.amount * 100),
          currency: req.currency,
          receipt: req.orderId.slice(0, 40),
          notes: { orderId: req.orderId, traceId: getTraceId() },
        }),
      });

      const data = (await response.json()) as { id?: string; status?: string; error?: { description?: string } };
      if (!response.ok || !data.id) {
        return { success: false, status: "failed", amount: req.amount, currency: req.currency, error: data.error?.description ?? "Razorpay create failed" };
      }

      return {
        success: true,
        providerOrderId: data.id,
        status: "pending",
        amount: req.amount,
        currency: req.currency,
        providerRaw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return { success: false, status: "failed", amount: req.amount, currency: req.currency, error: error instanceof Error ? error.message : "Razorpay create failed" };
    }
  }

  private async captureRazorpayPayment(paymentId: string, amount: number): Promise<PaymentResponse> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { success: false, status: "failed", amount, currency: "INR", error: "Razorpay not configured" };
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR" }),
      });

      const data = (await response.json()) as { id?: string; status?: string; error?: { description?: string } };
      if (!response.ok || data.status !== "captured") {
        return { success: false, status: "failed", amount, currency: "INR", error: data.error?.description ?? "Capture failed" };
      }

      return {
        success: true,
        providerPaymentId: data.id,
        status: "captured",
        amount,
        currency: "INR",
        providerRaw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return { success: false, status: "failed", amount, currency: "INR", error: error instanceof Error ? error.message : "Capture failed" };
    }
  }

  private async refundRazorpayPayment(paymentId: string, amount: number): Promise<PaymentResponse> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { success: false, status: "failed", amount, currency: "INR", error: "Razorpay not configured" };
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: Math.round(amount * 100) }),
      });

      const data = (await response.json()) as { id?: string; status?: string; error?: { description?: string } };
      if (!response.ok) {
        return { success: false, status: "failed", amount, currency: "INR", error: data.error?.description ?? "Refund failed" };
      }

      return {
        success: true,
        providerPaymentId: data.id,
        status: "refunded",
        amount,
        currency: "INR",
        providerRaw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return { success: false, status: "failed", amount, currency: "INR", error: error instanceof Error ? error.message : "Refund failed" };
    }
  }

  private async checkIdempotency(key: string): Promise<PaymentResponse | null> {
    return withRedis(async (redis) => {
      const cached = await redis.get(`idempotency:payment:${key}`);
      return cached ? (JSON.parse(cached) as PaymentResponse) : null;
    }, null as PaymentResponse | null);
  }

  private async cacheIdempotency(key: string, response: PaymentResponse): Promise<void> {
    await withRedis(async (redis) => {
      await redis.setex(`idempotency:payment:${key}`, IDEMPOTENCY_CACHE_TTL, JSON.stringify(response));
      return true;
    }, false);
  }

  private async recordLedger(entry: Omit<LedgerEntry, "id" | "createdAt" | "traceId">): Promise<void> {
    const ledgerEntry: LedgerEntry = {
      ...entry,
      id: crypto.randomUUID(),
      traceId: getTraceId(),
      createdAt: new Date().toISOString(),
    };

    await publishEvent({
      type: `payment.${entry.action}`,
      severity: entry.status === "failed" ? "warn" : "info",
      entityId: entry.orderId,
      entityType: "payment",
      payload: {
        ledger: true,
        ...ledgerEntry,
      },
    });

    await withRedis(async (redis) => {
      const cacheKey = `${LEDGER_CACHE_PREFIX}${entry.orderId}`;
      await redis.lpush(cacheKey, JSON.stringify(ledgerEntry));
      await redis.ltrim(cacheKey, 0, 999);
      await redis.expire(cacheKey, 86400 * 7);
      return true;
    }, false);
  }
}

export const paymentOrchestrator = new PaymentOrchestrator();
