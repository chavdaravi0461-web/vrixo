import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import { markCouponUsed } from "@/lib/game-coupons";
import { recordPaidOrderMemory, trackBehaviorEvent } from "@/services/behavior/customer-intelligence";
import { captureAppError, logInfo } from "@/lib/observability";
import { getAppUrl } from "@/lib/app-url";
import { dispatchOrderConfirmationWhatsApp } from "@/services/notifications/order-whatsapp";

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
};

export async function runPostOrderTasks(input: PostOrderTaskInput) {
  try {
    await runPostOrderTasksInternal(input);
  } catch (error) {
    await captureAppError(error, { area: "post_order_tasks", orderId: input.orderId });
  }
}

async function runPostOrderTasksInternal(input: PostOrderTaskInput) {
  logInfo("post_order_tasks.started", {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus
  });

  await Promise.allSettled([
    withTaskTimeout("coupon.mark_used", () => markCouponUsed(input.couponCode ?? null, input.orderId), 2500),
    withTaskTimeout("whatsapp.order_confirmation", () => sendCustomerWhatsApp(input), 15000),
    withTaskTimeout("invoice.enqueue", () => enqueueInvoice(input), 3500),
    withTaskTimeout("events.publish", () => publishOrderEvents(input), 3500),
    withTaskTimeout("behavior.track", () => trackOrderBehavior(input), 3500),
    withTaskTimeout("memory.update", () => updateCustomerMemory(input), 5000)
  ]);

  logInfo("post_order_tasks.completed", { orderId: input.orderId });
}

async function sendCustomerWhatsApp(input: PostOrderTaskInput) {
  const firstItem = input.items[0] ?? {};
  const productNames =
    input.items.map((item) => String(item.title ?? "")).filter(Boolean).join(", ") || "Vrixo product";

  await dispatchOrderConfirmationWhatsApp({
    orderId: input.orderId,
    userId: input.userId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    orderNumber: input.orderNumber,
    productNames,
    totalQty: input.items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0),
    totalAmount: input.total,
    orderStatus: input.orderStatus,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    productImageUrl: resolveProductImageUrl(firstItem),
    deliveryAddress: formatAddress(input.shippingAddress)
  });
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
    await Promise.race([
      task(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } catch (error) {
    await captureAppError(error, { area: name });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function resolveProductImageUrl(item: Record<string, unknown>) {
  const raw = String(item.image ?? item.productImageUrl ?? "");
  const appUrl = getAppUrl();

  if (!raw) {
    return `${appUrl}/placeholder-product.svg`;
  }

  try {
    return new URL(raw, appUrl).toString();
  } catch {
    return `${appUrl}/placeholder-product.svg`;
  }
}

function formatAddress(value: unknown) {
  if (!value || typeof value !== "object") return "Delivery address saved with your order";
  const address = value as Record<string, unknown>;
  return (
    [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
      .map((part) => (part ? String(part).trim() : ""))
      .filter(Boolean)
      .join(", ") || "Delivery address saved with your order"
  );
}
