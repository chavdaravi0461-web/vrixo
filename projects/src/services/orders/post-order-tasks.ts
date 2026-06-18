
import { publishEvent } from "@/lib/event-bus";
import { markCouponUsed } from "@/lib/game-coupons";
import { recordPaidOrderMemory, trackBehaviorEvent } from "@/services/behavior/customer-intelligence";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasEmailEnv, sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmailHtml } from "@/lib/email-templates/order-confirmation";
import { getAppUrl } from "@/lib/app-url";

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
  email: { sent: boolean; error?: string };
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
    withTaskTimeout("email.order_confirmation", () => sendCustomerEmail(input), 15000),
    withTaskTimeout("invoice.enqueue", () => enqueueInvoice(input), 5000),
    withTaskTimeout("events.publish", () => publishOrderEvents(input), 5000),
    withTaskTimeout("behavior.track", () => trackOrderBehavior(input), 5000),
    withTaskTimeout("memory.update", () => updateCustomerMemory(input), 5000)
  ]);

  const [couponResult, emailResult, , eventsResult, behaviorResult, memoryResult] = results;
  const emailValue =
    emailResult.status === "fulfilled"
      ? (emailResult.value as Awaited<ReturnType<typeof sendCustomerEmail>>)
      : null;
  const emailOutput: PostOrderTaskResult["email"] =
    emailResult.status === "fulfilled"
      ? {
          sent: Boolean(emailValue?.sent),
        }
      : { sent: false, error: extractError(emailResult.reason) };

  const output: PostOrderTaskResult = {
    email: emailOutput,
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

async function sendCustomerEmail(input: PostOrderTaskInput) {
  const logPayload = { orderId: input.orderId, orderNumber: input.orderNumber };

  if (!hasEmailEnv()) {
    logWarn("post_order_tasks.email.env_missing", logPayload);
    return { sent: false };
  }

  if (!input.customerEmail) {
    logWarn("post_order_tasks.email.no_email", logPayload);
    return { sent: false };
  }

  try {
    const emailResult = await sendEmail({
      to: input.customerEmail,
      subject: `Order Confirmed — ${input.orderNumber}`,
      html: buildOrderConfirmationEmailHtml({
        customerName: input.customerName,
        orderNumber: input.orderNumber,
        items: input.items,
        total: input.total,
        paymentMethod: input.paymentMethod,
        shippingAddress: input.shippingAddress
      })
    });

    if (emailResult.sent) {
      logInfo("post_order_tasks.email.sent", logPayload);
      return { sent: true };
    } else {
      logWarn("post_order_tasks.email.failed", { ...logPayload, error: emailResult.error });
      return { sent: false };
    }
  } catch (emailError) {
    logWarn("post_order_tasks.email.exception", { ...logPayload, error: emailError instanceof Error ? emailError.message : String(emailError) });
    return { sent: false };
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
