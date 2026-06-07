import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeDestructiveAction, isDestructiveIntent } from "./authorization";
import { checkSupportRateLimit, checkConfirmationRateLimit } from "./rate-limits";
import { checkIdempotency, markIdempotencyComplete, markIdempotencyFailed, generateActionId, isRecentlyProcessed, markOrderConfirmationProcessed, isOrderConfirmationProcessed } from "./idempotency";
import { assessFraudRisk, trackAction } from "./fraud-detection";
import { createPendingConfirmation, confirmPendingConfirmation, markConfirmationExecuted, getPendingConfirmationsForPhone, clearAllConfirmationsForPhone } from "./session-manager";
import { recordDestructiveAction, recordConfirmationConversion, recordSupportFailure, trackExecutionLatency } from "./observability";
import { checkDestructiveAllowed } from "./emergency-fallback";
import type { SupportContext, SupportOrder, ExecutionResult, SupportIntent } from "./types";

function getLatestEligible(
  orders: SupportOrder[],
  predicate: (o: SupportOrder) => boolean,
): SupportOrder | null {
  const eligible = orders.filter(predicate);
  if (eligible.length === 0) return null;
  return eligible.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

function buildSelectionResult(
  intent: SupportIntent,
  eligibleOrders: SupportOrder[],
): ExecutionResult {
  return {
    intent,
    action: "needs_selection",
    data: { eligibleOrders, count: eligibleOrders.length },
    message: `Found ${eligibleOrders.length} orders.`,
    eligibleOrders,
  };
}

function buildConfirmationResult(
  intent: SupportIntent,
  order: SupportOrder,
  actionLabel: string,
  consequence: string,
): ExecutionResult {
  return {
    intent,
    action: "awaiting_confirmation",
    data: { order },
    message: `Found order ${order.orderNumber}.\nStatus: ${order.orderStatus}\nEligible: Yes\n\nReply YES to confirm ${actionLabel}.`,
    confirmationRequired: true,
    confirmationDetails: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      action: actionLabel,
      consequence,
    },
  };
}

function buildBlockedResult(intent: SupportIntent, reason: string): ExecutionResult {
  return {
    intent,
    action: "error",
    data: { blocked: true, reason },
    message: reason,
    error: reason,
  };
}

function getIdentifier(ctx: SupportContext): string {
  return ctx.customer.phone || ctx.customer.userId || "unknown";
}

// ─── Protected handler wrapper ────────────────────────────────────────────────

async function protectedHandler(
  intent: SupportIntent,
  ctx: SupportContext,
  params: Record<string, unknown> | undefined,
  executeFn: (ctx: SupportContext, params?: Record<string, unknown>) => Promise<ExecutionResult>,
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const identifier = getIdentifier(ctx);
  const isDestructive = isDestructiveIntent(intent);

  const emergencyCheck = await checkDestructiveAllowed(intent);
  if (!emergencyCheck.allowed) {
    recordSupportFailure(intent, emergencyCheck.reason ?? "Emergency fallback active");
    return buildBlockedResult(intent, emergencyCheck.reason ?? "Service temporarily unavailable");
  }

  if (isDestructive) {
    const rateLimitResult = await checkSupportRateLimit(intent.replace("_order", ""), identifier);
    if (!rateLimitResult.allowed) {
      recordSupportFailure(intent, `Rate limited: ${rateLimitResult.reason}`);
      return buildBlockedResult(intent, `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`);
    }

    const fraudAssessment = await assessFraudRisk(intent, ctx);
    if (fraudAssessment.action === "block") {
      recordSupportFailure(intent, `Fraud blocked: ${fraudAssessment.flags.join(", ")}`);
      return buildBlockedResult(intent, "Action blocked due to suspicious activity. Please contact support.");
    }

    await trackAction(identifier, intent.replace("_order", ""));
  }

  const actionId = generateActionId();
  const idempotencyCheck = await checkIdempotency(actionId);
  if (idempotencyCheck.isDuplicate && !idempotencyCheck.shouldProceed) {
    return {
      intent,
      action: "executed",
      data: { duplicate: true, previousResult: idempotencyCheck.previousResult },
      message: "Action was already processed.",
    };
  }

  if (params?.orderNumber && isDestructive) {
    const authResult = await authorizeDestructiveAction({
      intent,
      orderNumber: params.orderNumber as string,
      context: ctx,
      sessionId: params.sessionId as string | undefined,
    });

    if (!authResult.authorized) {
      recordSupportFailure(intent, `Authorization failed: ${authResult.reason}`);
      const messages: Record<string, string> = {
        no_identifier: "Customer identification required.",
        order_not_found: "Order not found.",
        phone_mismatch: "This order does not belong to your account.",
        user_mismatch: "This order does not belong to your account.",
        session_inactive: "Session is no longer active. Please start again.",
        service_unavailable: "Authorization service unavailable. Please try again.",
      };
      return buildBlockedResult(intent, messages[authResult.code] ?? authResult.reason ?? "Not authorized");
    }
  }

  if (params?.confirmed === true && isDestructive) {
    const rateLimitResult = await checkConfirmationRateLimit(identifier);
    if (!rateLimitResult.allowed) {
      return buildBlockedResult(intent, `Too many confirmation attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`);
    }

    if (params.orderNumber) {
      const alreadyProcessed = await isOrderConfirmationProcessed(
        params.orderNumber as string,
        intent,
      );
      if (alreadyProcessed) {
        return {
          intent,
          action: "executed",
          data: { duplicate: true, orderNumber: params.orderNumber },
          message: "This action has already been processed for this order.",
        };
      }

      const recentlyProcessed = await isRecentlyProcessed(
        params.orderNumber as string,
        intent,
      );
      if (recentlyProcessed) {
        return {
          intent,
          action: "executed",
          data: { duplicate: true, orderNumber: params.orderNumber },
          message: "This action was recently processed. Please wait before trying again.",
        };
      }
    }

    const pendingConfirmations = await getPendingConfirmationsForPhone(identifier);
    const matchingConfirmations = pendingConfirmations.filter(
      (pc) => pc.intent === intent && pc.orderNumber === params.orderNumber,
    );

    if (matchingConfirmations.length > 0) {
      const latestConfirmation = matchingConfirmations.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      const confirmResult = await confirmPendingConfirmation(latestConfirmation.id);
      if (confirmResult.success) {
        try {
          const { result, latencyMs } = await trackExecutionLatency(intent, async () => {
            const execResult = await executeFn(ctx, { ...params, actionId });
            if (execResult.action === "executed") {
              await markConfirmationExecuted(latestConfirmation.id, identifier);
              await markOrderConfirmationProcessed(params.orderNumber as string, intent);
              await markIdempotencyComplete(actionId, execResult);
              await clearAllConfirmationsForPhone(identifier);
              recordDestructiveAction(intent, true, params.orderNumber as string, latencyMs, identifier);
              recordConfirmationConversion(intent, true, params.orderNumber as string);
            } else {
              await markIdempotencyFailed(actionId, execResult.error ?? "Execution failed");
              recordDestructiveAction(intent, false, params.orderNumber as string, latencyMs, identifier);
              recordConfirmationConversion(intent, false, params.orderNumber as string);
            }
            return execResult;
          });
          return result;
        } catch (error) {
          await markIdempotencyFailed(actionId, error instanceof Error ? error.message : String(error));
          return buildBlockedResult(intent, "Action failed. Please try again.");
        }
      } else {
        return buildBlockedResult(intent, confirmResult.reason ?? "Confirmation not valid");
      }
    }
  }

  if (isDestructive && params?.orderNumber && !params?.confirmed) {
    const pending = await createPendingConfirmation({
      intent,
      orderNumber: params.orderNumber as string,
      customerPhone: identifier,
      customerUserId: ctx.customer.userId,
    });

    return {
      intent,
      action: "awaiting_confirmation",
      data: { order: ctx.orders.find((o) => o.orderNumber === params.orderNumber), pendingConfirmationId: pending.id },
      message: `Please confirm. Reply YES to proceed with ${intent.replace("_order", "")} of order ${params.orderNumber}. This confirmation expires in 10 minutes.`,
      confirmationRequired: true,
      confirmationDetails: {
        orderNumber: params.orderNumber as string,
        orderStatus: ctx.orders.find((o) => o.orderNumber === params.orderNumber)?.orderStatus ?? "unknown",
        action: intent.replace("_order", ""),
        consequence: "This action cannot be reversed.",
      },
    };
  }

  try {
    const { result, latencyMs } = await trackExecutionLatency(intent, async () => {
      const execResult = await executeFn(ctx, { ...params, actionId });
      if (execResult.action === "executed") {
        await markIdempotencyComplete(actionId, execResult);
        if (params?.orderNumber) {
          recordDestructiveAction(intent, true, params.orderNumber as string, latencyMs, identifier);
        }
      } else if (execResult.action === "error") {
        await markIdempotencyFailed(actionId, execResult.error ?? "Execution failed");
        if (params?.orderNumber) {
          recordDestructiveAction(intent, false, params.orderNumber as string, latencyMs, identifier);
        }
      }
      return execResult;
    });
    return result;
  } catch (error) {
    await markIdempotencyFailed(actionId, error instanceof Error ? error.message : String(error));
    recordSupportFailure(intent, error instanceof Error ? error.message : String(error), params?.orderNumber as string | undefined);
    return buildBlockedResult(intent, "An unexpected error occurred. Please try again.");
  }
}

// ─── Non-destructive: order_status ────────────────────────────────────────────

export async function handleOrderStatus(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  if (!ctx.hasActiveOrders) {
    return { intent: "order_status", action: "not_found", data: {}, message: "No active orders found on your account." };
  }

  const targetOrder = params?.orderNumber
    ? ctx.orders.find((o) => o.orderNumber === params.orderNumber) ?? null
    : null;

  if (params?.orderNumber && !targetOrder) {
    return { intent: "order_status", action: "not_found", data: { searchedOrder: params.orderNumber }, message: `Order ${params.orderNumber} was not found on your account.` };
  }

  if (targetOrder) {
    return { intent: "order_status", action: "executed", data: { order: targetOrder }, message: `Order ${targetOrder.orderNumber}: ${targetOrder.orderStatus}. Payment: ${targetOrder.paymentStatus}.` };
  }

  if (ctx.orders.length > 1) {
    return buildSelectionResult("order_status", ctx.orders);
  }

  return { intent: "order_status", action: "executed", data: { order: ctx.orders[0] }, message: `Order ${ctx.orders[0].orderNumber}: ${ctx.orders[0].orderStatus}. Payment: ${ctx.orders[0].paymentStatus}.` };
}

// ─── Non-destructive: tracking ────────────────────────────────────────────────

export async function handleTracking(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const shipped = ctx.orders.filter(
    (o) => o.orderStatus === "shipped" || o.orderStatus === "packed" || o.orderStatus === "processing",
  );

  if (shipped.length === 0) {
    const pending = ctx.activeOrders.filter(
      (o) => o.orderStatus === "pending" || o.orderStatus === "confirmed",
    );
    if (pending.length > 0) {
      return { intent: "tracking", action: "executed", data: { order: pending[0] }, message: `Order ${pending[0].orderNumber} is ${pending[0].orderStatus}. It will be shipped soon. Estimated dispatch within 1-2 business days.` };
    }
    return { intent: "tracking", action: "not_found", data: {}, message: "No active shipments found on your account." };
  }

  if (params?.orderNumber) {
    const order = shipped.find((o) => o.orderNumber === params.orderNumber);
    if (!order) {
      return { intent: "tracking", action: "not_found", data: { searchedOrder: params.orderNumber }, message: `No shipping information found for order ${params.orderNumber}.` };
    }
    return { intent: "tracking", action: "executed", data: { order }, message: `Order ${order.orderNumber}: ${order.orderStatus}.${order.trackingNumber ? ` Tracking: ${order.trackingNumber}.` : ""}${order.estimatedDelivery ? ` Expected delivery: ${order.estimatedDelivery}.` : ""}` };
  }

  if (shipped.length > 1) {
    return buildSelectionResult("tracking", shipped);
  }

  const order = shipped[0];
  return { intent: "tracking", action: "executed", data: { order }, message: `Order ${order.orderNumber}: ${order.orderStatus}.${order.trackingNumber ? ` Tracking: ${order.trackingNumber}.` : ""}${order.estimatedDelivery ? ` Expected delivery: ${order.estimatedDelivery}.` : ""}` };
}

// ─── Non-destructive: payment_issue ───────────────────────────────────────────

export async function handlePaymentIssue(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const pending = ctx.orders.filter(
    (o) => o.paymentStatus === "pending" && o.paymentMethod === "online" && o.orderStatus !== "cancelled",
  );

  if (pending.length === 0) {
    return { intent: "payment_issue", action: "not_found", data: {}, message: "No pending payments found on your account." };
  }

  if (params?.orderNumber) {
    const order = pending.find((o) => o.orderNumber === params.orderNumber);
    if (!order) {
      return { intent: "payment_issue", action: "not_found", data: { searchedOrder: params.orderNumber }, message: `No payment issue found for order ${params.orderNumber}.` };
    }
    return { intent: "payment_issue", action: "executed", data: { order }, message: `Order ${order.orderNumber} has a pending online payment of Rs.${order.total}. You can retry the payment or switch to COD.` };
  }

  if (pending.length > 1) {
    return buildSelectionResult("payment_issue", pending);
  }

  return { intent: "payment_issue", action: "executed", data: { order: pending[0] }, message: `Order ${pending[0].orderNumber} has a pending payment of Rs.${pending[0].total}. Would you like to retry payment or switch to COD?` };
}

// ─── Destructive: cancel_order (requires explicit confirmation) ───────────────

export async function handleCancelOrder(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  return protectedHandler("cancel_order", ctx, params, async (innerCtx, innerParams) => {
    const eligible = innerCtx.orders.filter((o) => o.isCancellable);

    if (eligible.length === 0) {
      return { intent: "cancel_order", action: "not_eligible", data: {}, message: "No eligible orders found for cancellation. Cancellation is only available for pending or confirmed orders." };
    }

    if (innerParams?.orderNumber) {
      const order = eligible.find((o) => o.orderNumber === innerParams.orderNumber);
      if (!order) {
        return { intent: "cancel_order", action: "not_found", data: { searchedOrder: innerParams.orderNumber }, message: `Order ${innerParams.orderNumber} was not found or is not eligible for cancellation.` };
      }
      if (innerParams?.confirmed === true) {
        return executeConfirmedCancel(order);
      }
      return buildConfirmationResult("cancel_order", order, "cancellation", "This order will be cancelled and cannot be reversed.");
    }

    if (eligible.length > 1) {
      return buildSelectionResult("cancel_order", eligible);
    }

    return buildConfirmationResult("cancel_order", eligible[0], "cancellation", "This order will be cancelled and cannot be reversed.");
  });
}

async function executeConfirmedCancel(order: SupportOrder): Promise<ExecutionResult> {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        order_status: "cancelled",
        payment_status: order.paymentMethod === "cod" ? "cod_pending" : "refunded",
        notes: { cancelled_at: new Date().toISOString(), cancelled_via: "support_chat" },
        updated_at: new Date().toISOString(),
      })
      .eq("order_number", order.orderNumber);

    if (error) {
      return { intent: "cancel_order", action: "error", data: { order, error: error.message }, message: "Failed to cancel the order. Please try again.", error: error.message };
    }
    return { intent: "cancel_order", action: "executed", data: { order }, message: `Order ${order.orderNumber} has been cancelled successfully.` };
  } catch {
    return { intent: "cancel_order", action: "error", data: { order }, message: "Order service unavailable. Please try again later." };
  }
}

// ─── Destructive: refund (requires explicit confirmation) ─────────────────────

export async function handleRefund(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  return protectedHandler("refund", ctx, params, async (innerCtx, innerParams) => {
    const refundable = innerCtx.orders.filter((o) => o.isReturnable && o.paymentStatus === "paid");

    if (refundable.length === 0) {
      return { intent: "refund", action: "not_eligible", data: {}, message: "No refund-eligible orders found. Refunds are available for paid delivered orders within the return window." };
    }

    if (innerParams?.orderNumber) {
      const order = refundable.find((o) => o.orderNumber === innerParams.orderNumber);
      if (!order) {
        return { intent: "refund", action: "not_found", data: { searchedOrder: innerParams.orderNumber }, message: `Order ${innerParams.orderNumber} is not eligible for refund.` };
      }
      if (innerParams?.confirmed === true) {
        return executeConfirmedRefund(order);
      }
      return buildConfirmationResult("refund", order, "refund", `Rs.${order.total} will be refunded.`);
    }

    if (refundable.length > 1) {
      return buildSelectionResult("refund", refundable);
    }

    return buildConfirmationResult("refund", refundable[0], "refund", `Rs.${refundable[0].total} will be refunded.`);
  });
}

async function executeConfirmedRefund(order: SupportOrder): Promise<ExecutionResult> {
  return { intent: "refund", action: "executed", data: { order }, message: `Refund initiated for order ${order.orderNumber} of Rs.${order.total}. A support agent will process it.` };
}

// ─── Destructive: return_order (requires explicit confirmation) ───────────────

export async function handleReturn(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  return protectedHandler("return_order", ctx, params, async (innerCtx, innerParams) => {
    const returnable = innerCtx.orders.filter((o) => o.isReturnable);

    if (returnable.length === 0) {
      return { intent: "return_order", action: "not_eligible", data: {}, message: "No return-eligible orders found. Returns are available for delivered orders within the return window." };
    }

    if (innerParams?.orderNumber) {
      const order = returnable.find((o) => o.orderNumber === innerParams.orderNumber);
      if (!order) {
        return { intent: "return_order", action: "not_found", data: { searchedOrder: innerParams.orderNumber }, message: `Order ${innerParams.orderNumber} is not eligible for return.` };
      }
      if (innerParams?.confirmed === true) {
        return executeConfirmedReturn(order);
      }
      return buildConfirmationResult("return_order", order, "return", "Return instructions will be shared after confirmation.");
    }

    if (returnable.length > 1) {
      return buildSelectionResult("return_order", returnable);
    }

    return buildConfirmationResult("return_order", returnable[0], "return", "Return instructions will be shared after confirmation.");
  });
}

async function executeConfirmedReturn(order: SupportOrder): Promise<ExecutionResult> {
  return { intent: "return_order", action: "executed", data: { order }, message: `Return initiated for order ${order.orderNumber}. Instructions will be shared shortly.` };
}

// ─── Destructive: replace_order (requires explicit confirmation) ──────────────

export async function handleReplace(
  ctx: SupportContext,
  params?: Record<string, unknown>,
): Promise<ExecutionResult> {
  return protectedHandler("replace_order", ctx, params, async (innerCtx, innerParams) => {
    const replaceable = innerCtx.orders.filter((o) => o.isReturnable);

    if (replaceable.length === 0) {
      return { intent: "replace_order", action: "not_eligible", data: {}, message: "No orders eligible for replacement. Replacements are available for delivered orders." };
    }

    if (innerParams?.orderNumber) {
      const order = replaceable.find((o) => o.orderNumber === innerParams.orderNumber);
      if (!order) {
        return { intent: "replace_order", action: "not_found", data: { searchedOrder: innerParams.orderNumber }, message: `Order ${innerParams.orderNumber} is not eligible for replacement.` };
      }
      if (innerParams?.confirmed === true) {
        return executeConfirmedReplace(order);
      }
      return buildConfirmationResult("replace_order", order, "replacement", "A replacement order will be created after confirmation.");
    }

    if (replaceable.length > 1) {
      return buildSelectionResult("replace_order", replaceable);
    }

    return buildConfirmationResult("replace_order", replaceable[0], "replacement", "A replacement order will be created after confirmation.");
  });
}

async function executeConfirmedReplace(order: SupportOrder): Promise<ExecutionResult> {
  return { intent: "replace_order", action: "executed", data: { order }, message: `Replacement initiated for order ${order.orderNumber}. A support agent will contact you.` };
}

// ─── Handler registry ─────────────────────────────────────────────────────────

export const intentHandlers: Record<
  SupportIntent,
  (ctx: SupportContext, params?: Record<string, unknown>) => Promise<ExecutionResult>
> = {
  order_status: handleOrderStatus,
  cancel_order: handleCancelOrder,
  refund: handleRefund,
  return_order: handleReturn,
  replace_order: handleReplace,
  tracking: handleTracking,
  payment_issue: handlePaymentIssue,
  product_question: async () => ({ intent: "product_question", action: "executed", data: {}, message: "" }),
  cod_question: async () => ({ intent: "cod_question", action: "executed", data: {}, message: "" }),
  support_escalation: async () => ({ intent: "support_escalation", action: "executed", data: {}, message: "I'll connect you with a support agent." }),
};
