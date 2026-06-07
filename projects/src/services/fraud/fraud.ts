import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "node:crypto";
import { publishEvent } from "@/lib/event-bus";
import { withRedis } from "@/lib/redis";
import { captureAppError } from "@/lib/observability";
import { getAdaptiveThresholds, recordFraudOutcome } from "@/lib/adaptive-fraud";

// Disposable email/phone provider list (common vendors)
const DISPOSABLE_EMAIL_DOMAINS = ["tempmail.com", "10minutemail.com", "mailinator.com", "throwaway.email"];
const DISPOSABLE_PHONE_PREFIXES = ["91911", "91999", "919876543"]; // India VoIP indicators

// Device fingerprint computation
function computeDeviceFingerprint(ua: string | undefined, ip: string | undefined): string {
  const combined = `${ua || ""}:${ip || ""}`;
  return crypto.createHash("sha256").update(combined).digest("hex").substring(0, 16);
}

// Disposable email detection
function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain) || /^[0-9]{10}@/.test(email);
}

// Disposable phone detection (India-centric VoIP patterns)
function isDisposablePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return DISPOSABLE_PHONE_PREFIXES.some((p) => cleaned.startsWith(p));
}

export type FraudContext = {
  ip?: string;
  userAgent?: string;
  email?: string;
  phone?: string;
  userId?: string;
  paymentMethod?: "cod" | "online";
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  orderTotal?: number;
  items?: Array<Record<string, unknown>>;
  razorpayOrderId?: string;
};

export type FraudDecision = {
  score: number;
  action: "allow" | "review" | "block";
  flagged: boolean;
  flags: string[];
  deviceFingerprint?: string;
};

export async function computeRiskScore(ctx: FraudContext): Promise<FraudDecision> {
  let score = 0;
  const flags: string[] = [];
  const deviceFingerprint = ctx.userAgent || ctx.ip ? computeDeviceFingerprint(ctx.userAgent, ctx.ip) : undefined;
  const adaptiveThresholds = await getAdaptiveThresholds();

  if (await isBlocklisted(ctx.email ?? "", ctx.phone ?? "", deviceFingerprint)) {
    score += 90;
    flags.push("blocklisted_identity");
  }

  // high order amount increases risk (adaptive thresholds)
  if (ctx.orderTotal && ctx.orderTotal > adaptiveThresholds.highOrderAmount) score += 10;
  if (ctx.orderTotal && ctx.orderTotal > adaptiveThresholds.extremeOrderAmount) score += 20;

  // disposable email/phone detection
  if (ctx.email && isDisposableEmail(ctx.email)) {
    score += 25;
    flags.push("disposable_email");
  }
  if (ctx.phone && isDisposablePhone(ctx.phone)) {
    score += 25;
    flags.push("disposable_phone");
  }

  // device fingerprinting: track devices per customer
  if (deviceFingerprint) {
    const fpCount = await withRedis(async (redis) => {
      const fpKey = `fraud:device:${deviceFingerprint}`;
      const count = await redis.incr(fpKey);
      if (count === 1) await redis.expire(fpKey, 86400 * 7);
      return count;
    }, 0);
    if (fpCount > adaptiveThresholds.deviceReuseThreshold) {
        score += 15;
        flags.push("suspicious_device_reuse");
    }
  }

  // mismatched phone/email
  if (ctx.email && ctx.phone && ctx.email.includes("+")) score += 5;

  // suspicious shipping addresses (PO boxes heuristics)
  const shipping = ctx.shippingAddress;
  if (shipping && typeof shipping === "object") {
    const line1 = String(shipping.line1 ?? "").toLowerCase();
    if (line1.includes("po box") || line1.includes("pobox")) {
      score += 15;
      flags.push("po_box_address");
    }
  }

  // IP velocity: many orders from same IP in short time
  if (ctx.ip) {
    const count = await withRedis(async (redis) => {
      const key = `fraud:ip:${ctx.ip}`;
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, 60 * 60);
      return current;
    }, 0);
    if (count > adaptiveThresholds.ipVelocityWarn) {
        score += 20;
        flags.push("high_ip_velocity");
    }
    if (count > adaptiveThresholds.ipVelocityBlock) {
        score += 40;
        flags.push("extreme_ip_velocity");
    }
  }

  // device/user-agent heuristics
  if (ctx.userAgent && /curl|python|bot|spider/i.test(ctx.userAgent)) {
    score += 40;
    flags.push("suspicious_user_agent");
  }

  // items with large quantity anomalies
  if (Array.isArray(ctx.items)) {
    for (const it of ctx.items) {
      if (Number(it.quantity ?? 0) > adaptiveThresholds.bulkOrderThreshold) {
        score += 10;
        flags.push("bulk_order");
      }
    }
  }

  // COD abuse pattern: customer has history of failed/cancelled COD orders
  if (ctx.email || ctx.phone) {
    try {
      const supabase = createAdminClient();
      const identifier = ctx.email || ctx.phone;
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq(ctx.email ? "email" : "customer_phone", identifier)
        .in("order_status", ["cancelled", "returned"]);
      if (count && count > adaptiveThresholds.codAbuseCount) {
        score += ctx.paymentMethod === "cod" ? 35 : 20;
        flags.push("cod_abuse_pattern");
      }
    } catch (error) {
      await captureAppError(error, { area: "fraud.cod_abuse" });
    }
  }

  score += await analyzeSuspiciousPattern(ctx, flags);

  // clamp score 0..100
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  const action = score >= adaptiveThresholds.blockScore ? "block" : score >= adaptiveThresholds.reviewScore ? "review" : "allow";

  await recordFraudOutcome(score, action, "unknown").catch(() => undefined);

  return { score, action, flagged: score >= adaptiveThresholds.reviewScore, flags, deviceFingerprint };
}

export async function recordFraudAlert(orderId: string, details: Record<string, unknown>) {
  const supabase = createAdminClient();
  await supabase.from("fraud_alerts").insert({ order_id: orderId, details });
  await withRedis(async (redis) => {
    await redis.lpush("fraud:alerts", JSON.stringify({ orderId, details, createdAt: new Date().toISOString(), resolved: false }));
    await redis.ltrim("fraud:alerts", 0, 999);
    await redis.expire("fraud:alerts", 60 * 60 * 24 * 30);
    return true;
  }, false);
  // publish realtime alert
  await publishEvent({
    type: "fraud.alert",
    severity: Number(details.score ?? 0) >= 85 ? "critical" : "warn",
    entityId: orderId,
    entityType: "order",
    payload: details
  });
}

// Blocklist operations
export async function blockCustomer(email: string, phone: string, reason: string, deviceFingerprint?: string) {
  const supabase = createAdminClient();
  const key = `fraud:blocklist:${email}:${phone}`;
  await withRedis(async (redis) => {
    await redis.setex(key, 86400 * 30, reason);
    if (deviceFingerprint) await redis.setex(`fraud:blocklist:device:${deviceFingerprint}`, 86400 * 30, reason);
    return true;
  }, false);
  await supabase.from("fraud_blocklist").insert({ email: email || null, phone: phone || null, device_fingerprint: deviceFingerprint ?? null, reason });
  await supabase.from("fraud_alerts").insert({ details: { type: "blocklist", email, phone, deviceFingerprint, reason } });
}

export async function isBlocklisted(email: string, phone: string, deviceFingerprint?: string): Promise<boolean> {
  const key = `fraud:blocklist:${email}:${phone}`;
  const cached = await withRedis(async (redis) => {
    const result = await redis.get(key);
    const deviceResult = deviceFingerprint ? await redis.get(`fraud:blocklist:device:${deviceFingerprint}`) : null;
    return Boolean(result || deviceResult);
  }, false);
  if (cached) return true;

  try {
    const query = createAdminClient()
      .from("fraud_blocklist")
      .select("id")
      .or(`email.eq.${email || "__none__"},phone.eq.${phone || "__none__"}${deviceFingerprint ? `,device_fingerprint.eq.${deviceFingerprint}` : ""}`)
      .limit(1);
    const { data } = await query;
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

export async function getHighRiskOrders(limit = 50) {
  return withRedis(async (redis) => {
    const rows = await redis.lrange("fraud:alerts", 0, Math.max(0, limit - 1));
    return rows.map((row) => JSON.parse(row));
  }, [] as Array<Record<string, unknown>>);
}

export async function markFraudResolved(alertId: string) {
  await createAdminClient()
    .from("fraud_alerts")
    .update({ resolved: true })
    .eq("id", alertId);
  await withRedis(async (redis) => {
    await redis.setex(`fraud:resolved:${alertId}`, 60 * 60 * 24 * 30, "true");
    return true;
  }, false);
}

export async function isHighRiskOrder(ctx: FraudContext) {
  const r = await computeRiskScore(ctx);
  return r;
}

export async function evaluatePaymentRisk(ctx: FraudContext) {
  const decision = await computeRiskScore(ctx);

  if (decision.action === "block") {
    await publishEvent({
      type: "payment.blocked",
      severity: "critical",
      customerId: ctx.userId ?? null,
      entityId: ctx.razorpayOrderId ?? null,
      entityType: "payment",
      payload: { ...decision, email: ctx.email, phone: ctx.phone, orderTotal: ctx.orderTotal }
    });
  } else if (decision.action === "review") {
    await publishEvent({
      type: "payment.risk_review",
      severity: "warn",
      customerId: ctx.userId ?? null,
      entityId: ctx.razorpayOrderId ?? null,
      entityType: "payment",
      payload: { ...decision, email: ctx.email, phone: ctx.phone, orderTotal: ctx.orderTotal }
    });
  }

  return decision;
}

async function analyzeSuspiciousPattern(ctx: FraudContext, flags: string[]) {
  if (!process.env.OPENAI_API_KEY) return 0;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Return only compact JSON: {\"risk\":0-25,\"flags\":[\"snake_case\"]}. Score ecommerce fraud risk from provided checkout signals."
        },
        {
          role: "user",
          content: JSON.stringify({
            orderTotal: ctx.orderTotal,
            paymentMethod: ctx.paymentMethod,
            phone: ctx.phone,
            emailDomain: ctx.email?.split("@")[1] ?? "",
            itemCount: ctx.items?.length ?? 0,
            quantities: ctx.items?.map((item) => item.quantity),
            shippingAddress: ctx.shippingAddress,
            userAgent: ctx.userAgent
          })
        }
      ],
      max_tokens: 120,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content ?? "{}") as { risk?: number; flags?: string[] };
    for (const flag of parsed.flags ?? []) flags.push(`ai_${flag}`);
    return Math.max(0, Math.min(25, Number(parsed.risk ?? 0)));
  } catch (error) {
    await publishEvent({
      type: "ai.failure",
      severity: "warn",
      payload: { area: "fraud_pattern_analysis", error: error instanceof Error ? error.message : String(error) }
    });
    return 0;
  }
}
