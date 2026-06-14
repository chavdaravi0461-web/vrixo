
import { publishEvent } from "@/lib/event-bus";
import { markCouponUsed } from "@/lib/game-coupons";
import { recordPaidOrderMemory, trackBehaviorEvent } from "@/services/behavior/customer-intelligence";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasEmailEnv, sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmailHtml } from "@/lib/email-templates/order-confirmation";
import { sendOrderConfirmationWhatsApp, formatWhatsAppPhone, hasWhatsAppServerEnv } from "@/lib/whatsapp";
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
  whatsapp: { sent: boolean; error?: string };
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
  let whatsappSent = false;

  // Step 1: Try direct WhatsApp send (primary path)
  if (hasWhatsAppServerEnv()) {
    const formattedPhone = formatWhatsAppPhone(input.customerPhone);
    if (formattedPhone) {
      const items = input.items || [];
      const productNames = items
        .map((item) => String(item.title ?? ""))
        .filter(Boolean)
        .join(", ") || "Vrixo product";
      const totalQty = items.reduce(
        (sum, item) => sum + (typeof item.quantity === "number" ? item.quantity : 1),
        0
      );
      const firstItem = items[0] && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : {};
      const rawImage = String(firstItem.image ?? firstItem.productImageUrl ?? "");
      const appUrl = getAppUrl();
      const productImageUrl = rawImage
        ? (() => { try { return new URL(rawImage, appUrl).toString(); } catch { return `${appUrl}/placeholder-product.svg`; } })()
        : `${appUrl}/placeholder-product.svg`;

      const addr = input.shippingAddress as Record<string, unknown> | null;
      const address = addr
        ? [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
            .map((p) => (p ? String(p).trim() : ""))
            .filter(Boolean)
            .join(", ")
        : "Delivery address saved with your order";

      try {
        const result = await sendOrderConfirmationWhatsApp({
          customerName: input.customerName,
          customerPhone: formattedPhone,
          orderNumber: input.orderNumber,
          productNames,
          totalQty,
          totalAmount: input.total,
          orderStatus: input.orderStatus,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          productImageUrl,
          deliveryAddress: address
        });

        if (result.sent) {
          logInfo("post_order_tasks.whatsapp.direct_sent", {
            ...logPayload,
            providerMessageId: result.customerMessageId
          });
          whatsappSent = true;

          // Update order whatsapp_status
          const supabase = createAdminClient();
          await supabase
            .from("orders")
            .update({ whatsapp_status: "sent", whatsapp_error: null })
            .eq("id", input.orderId);
        } else {
          logWarn("post_order_tasks.whatsapp.direct_failed", {
            ...logPayload,
            error: result.error
          });
        }
      } catch (error) {
        logError("post_order_tasks.whatsapp.direct_exception", {
          ...logPayload,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      logWarn("post_order_tasks.whatsapp.invalid_phone", { ...logPayload, phone: input.customerPhone });
    }
  } else {
    logWarn("post_order_tasks.whatsapp.env_missing", logPayload);
  }

  // Step 2: Email fallback — send if WhatsApp failed and email is configured
  if (!whatsappSent && hasEmailEnv() && input.customerEmail) {
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
        logInfo("post_order_tasks.email.fallback_sent", logPayload);
      } else {
        logWarn("post_order_tasks.email.fallback_failed", { ...logPayload, error: emailResult.error });
      }
    } catch (emailError) {
      logWarn("post_order_tasks.email.fallback_exception", { ...logPayload, error: emailError instanceof Error ? emailError.message : String(emailError) });
    }
  }

  return { sent: whatsappSent };
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
