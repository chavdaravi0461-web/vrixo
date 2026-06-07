
import { publishEvent } from "@/lib/event-bus";
import { markCouponUsed } from "@/lib/game-coupons";
import { recordPaidOrderMemory, trackBehaviorEvent } from "@/services/behavior/customer-intelligence";
import { logInfo, logWarn, logError } from "@/lib/observability";
import {
  dispatchOrderNotification,
  enqueueOrderConfirmationNotification
} from "@/lib/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";

export type PostOrderTaskInput = {
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  couponCode?: string | null;
  orderStatus: string;
  paymentMethod: "cod" | "online";
  paymentStatus: string;
  total: number;
  items: Array<Record<string, unknown>>;
  shippingAddress: unknown;
  sessionId?: string | null;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  requestId?: string;
};

export type PostOrderTaskResult = {
  whatsapp: { sent: boolean; skipped?: boolean; reason?: string; error?: string };
  coupon: { used: boolean; error?: string };
  events: { published: boolean };
  behavior: { tracked: boolean };
  memory: { updated: boolean };
};

export async function runPostOrderTasks(input: PostOrderTaskInput): Promise<PostOrderTaskResult> {
  const startTime = performance.now();
  logInfo("post_order_tasks.start", {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    requestId: input.requestId
  });

  const results = await Promise.allSettled([
    withTaskTimeout("coupon.mark_used", () => markCouponUsed(input.couponCode ?? null, input.orderId), 5000),
    withTaskTimeout("whatsapp.order_confirmation", () => sendCustomerWhatsApp(input), 20000),
    withTaskTimeout("invoice.enqueue", () => enqueueInvoice(input), 5000),
    withTaskTimeout("events.publish", () => publishOrderEvents(input), 5000),
    withTaskTimeout("behavior.track", () => trackOrderBehavior(input), 5000),
    withTaskTimeout("memory.update", () => updateCustomerMemory(input), 5000)
  ]);

  const [couponResult, whatsappResult, , eventsResult, behaviorResult, memoryResult] = results;
  const whatsappValue =
    whatsappResult.status === "fulfilled"
      ? (whatsappResult.value as Awaited<ReturnType<typeof sendCustomerWhatsApp>>)
      : null;
  const whatsappOutput: PostOrderTaskResult["whatsapp"] =
    whatsappResult.status === "fulfilled"
      ? {
          sent: Boolean(whatsappValue?.sent),
          skipped: whatsappValue?.skipped,
          reason: whatsappValue?.reason
        }
      : { sent: false, error: extractError(whatsappResult.reason) };

  const output: PostOrderTaskResult = {
    whatsapp: whatsappOutput,
    coupon: couponResult.status === "fulfilled"
      ? { used: true }
      : { used: false, error: extractError(couponResult.reason) },
    events: { published: eventsResult.status === "fulfilled" },
    behavior: { tracked: behaviorResult.status === "fulfilled" },
    memory: { updated: memoryResult.status === "fulfilled" }
  };

  logInfo("post_order_tasks.complete", {
    orderId: input.orderId,
    durationMs: Math.round(performance.now() - startTime),
    ...output
  });

  return output;
}

async function sendCustomerWhatsApp(input: PostOrderTaskInput) {
  const logPayload = { orderId: input.orderId, orderNumber: input.orderNumber };
  const supabase = createAdminClient();
  try {
    const notificationId = await enqueueOrderConfirmationNotification(supabase, input.orderId);
    if (!notificationId) {
      return {
        queued: false,
        sent: false,
        skipped: true,
        reason: "online_payment_not_confirmed"
      };
    }

    logInfo("post_order_tasks.whatsapp.outbox_enqueued", { ...logPayload, notificationId });
    const result = await dispatchOrderNotification(supabase, notificationId);
    if (result.sent) {
      logInfo("post_order_tasks.whatsapp.sent", {
        ...logPayload,
        notificationId,
        providerMessageId: result.providerMessageId
      });
      return { queued: true, sent: true };
    }

    logWarn("post_order_tasks.whatsapp.retry_scheduled", {
      ...logPayload,
      notificationId,
      error: result.error
    });
    return { queued: true, sent: false, error: result.error ?? undefined };
  } catch (error) {
    logError("post_order_tasks.whatsapp.outbox_failed", {
      ...logPayload,
      error: extractError(error)
    });
    throw error;
  }
}

async function enqueueInvoice(input: PostOrderTaskInput) {
  if (input.paymentMethod !== "online" || input.paymentStatus !== "paid") return;
  const { enqueueInvoiceJob } = await import("@/services/notifications/invoice-queue");
  await enqueueInvoiceJob({
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    items: input.items,
    total: input.total
  });
}

async function publishOrderEvents(input: PostOrderTaskInput) {
  await publishEvent({
    type: input.paymentStatus === "paid" ? "order.confirmed" : "order.created",
    severity: "info",
    entityId: input.orderId,
    entityType: "order",
    customerId: input.userId,
    payload: {
      orderNumber: input.orderNumber,
      total: input.total,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId
    }
  });
}

async function trackOrderBehavior(input: PostOrderTaskInput) {
  await trackBehaviorEvent({
    userId: input.userId,
    sessionId: input.sessionId || input.userId,
    eventType: "purchase",
    path: "/checkout",
    value: input.total,
    metadata: {
      orderId: input.orderId,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus
    }
  });
}

async function updateCustomerMemory(input: PostOrderTaskInput) {
  if (input.paymentMethod === "online" && input.paymentStatus !== "paid") return;
  await recordPaidOrderMemory(input.userId, { total: input.total, items: input.items });
}

async function withTaskTimeout(name: string, task: () => Promise<unknown>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } catch (error) {
    logWarn("post_order_tasks.task_failed", { taskName: name, error: extractError(error) });
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function extractError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
