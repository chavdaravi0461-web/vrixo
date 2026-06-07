import "server-only";
import { withRedis } from "@/lib/redis";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import { securityLog } from "@/lib/security";
import type { SupportIntent, SupportContext } from "./types";

export type FraudAssessment = {
  flagged: boolean;
  score: number;
  flags: string[];
  action: "allow" | "block" | "review";
  reason?: string;
};

const FRAUD_THRESHOLDS = {
  excessiveCancellations: 3,
  excessiveRefunds: 2,
  massSupportAbuse: 10,
  repeatedOrderProbing: 8,
  cancellationWindowMs: 3600_000,
  refundWindowMs: 3600_000,
  supportWindowMs: 300_000,
  probeWindowMs: 600_000,
};

function buildKey(prefix: string, identifier: string): string {
  return `support:fraud:${prefix}:${identifier}`;
}

export async function trackAction(
  identifier: string,
  action: string,
): Promise<number> {
  const key = buildKey(action, identifier);
  return withRedis(async (redis) => {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, 3600_000);
    }
    return count;
  }, 0);
}

export async function getActionCount(
  identifier: string,
  action: string,
  windowMs: number,
): Promise<number> {
  const key = buildKey(action, identifier);
  return withRedis(async (redis) => {
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }, 0);
}

export async function assessFraudRisk(
  intent: SupportIntent,
  context: SupportContext,
): Promise<FraudAssessment> {
  const flags: string[] = [];
  let score = 0;
  const phone = context.customer.phone;
  const userId = context.customer.userId;
  const identifier = phone || userId || "unknown";

  if (intent === "cancel_order") {
    const recentCancellations = await getActionCount(
      identifier,
      "cancel",
      FRAUD_THRESHOLDS.cancellationWindowMs,
    );
    if (recentCancellations >= FRAUD_THRESHOLDS.excessiveCancellations) {
      score += 40;
      flags.push("excessive_cancellations");
      securityLog("fraud.excessive_cancellations", { identifier, count: recentCancellations });
    }

    const todayCancelCount = context.cancelledOrders.length;
    if (todayCancelCount > FRAUD_THRESHOLDS.excessiveCancellations * 2) {
      score += 20;
      flags.push("historical_cancel_abuse");
    }
  }

  if (intent === "refund") {
    const recentRefunds = await getActionCount(
      identifier,
      "refund",
      FRAUD_THRESHOLDS.refundWindowMs,
    );
    if (recentRefunds >= FRAUD_THRESHOLDS.excessiveRefunds) {
      score += 50;
      flags.push("excessive_refund_requests");
      securityLog("fraud.excessive_refunds", { identifier, count: recentRefunds });
    }

    const refundedCount = context.refundedOrders.length;
    if (refundedCount > FRAUD_THRESHOLDS.excessiveRefunds) {
      score += 20;
      flags.push("historical_refund_abuse");
    }
  }

  if (intent === "return_order" || intent === "replace_order") {
    const recentReturns = await getActionCount(
      identifier,
      "return",
      FRAUD_THRESHOLDS.refundWindowMs,
    );
    if (recentReturns >= FRAUD_THRESHOLDS.excessiveRefunds) {
      score += 35;
      flags.push("excessive_return_requests");
    }
  }

  const totalSupportMessages = await getActionCount(
    identifier,
    "support_message",
    FRAUD_THRESHOLDS.supportWindowMs,
  );
  if (totalSupportMessages >= FRAUD_THRESHOLDS.massSupportAbuse) {
    score += 30;
    flags.push("mass_support_abuse");
    securityLog("fraud.mass_support_abuse", { identifier, count: totalSupportMessages });
  }

  const orderLookups = await getActionCount(
    identifier,
    "order_lookup",
    FRAUD_THRESHOLDS.probeWindowMs,
  );
  if (orderLookups >= FRAUD_THRESHOLDS.repeatedOrderProbing) {
    score += 25;
    flags.push("repeated_order_probing");
    securityLog("fraud.repeated_probing", { identifier, count: orderLookups });
  }

  if (score >= 70) {
    await publishEvent({
      type: "fraud.alert",
      severity: "critical",
      entityId: identifier,
      entityType: "support",
      payload: { intent, score, flags, phone, userId },
    }).catch(() => undefined);
  }

  score = Math.min(100, Math.max(0, score));

  let action: "allow" | "block" | "review";
  if (score >= 70) {
    action = "block";
  } else if (score >= 40) {
    action = "review";
  } else {
    action = "allow";
  }

  return {
    flagged: score >= 40,
    score,
    flags,
    action,
    reason: flags.length > 0 ? `Suspicious pattern detected: ${flags.join(", ")}` : undefined,
  };
}

export async function checkOrderProbeFraud(
  identifier: string,
): Promise<FraudAssessment> {
  const count = await getActionCount(
    identifier,
    "order_lookup",
    FRAUD_THRESHOLDS.probeWindowMs,
  );

  if (count >= FRAUD_THRESHOLDS.repeatedOrderProbing) {
    return {
      flagged: true,
      score: 25,
      flags: ["repeated_order_probing"],
      action: "review",
      reason: "Too many order lookups in short time",
    };
  }

  return { flagged: false, score: 0, flags: [], action: "allow" };
}
