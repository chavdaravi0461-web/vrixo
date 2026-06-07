import { getAppUrl } from "@/lib/app-url";
import { type CustomerContext, type CustomerOrderDetailed } from "@/lib/whatsapp/customer-context";

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(amount)));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STATUS_EMOJI: Record<string, string> = {
  pending: "📋",
  confirmed: "✅",
  processing: "⚙️",
  packed: "📦",
  shipped: "🚚",
  delivered: "🎉",
  cancelled: "❌",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_EMOJI: Record<string, string> = {
  cod_pending: "💵",
  paid: "✅",
  failed: "❌",
  refunded: "🔄",
};

const PAYMENT_LABEL: Record<string, string> = {
  cod_pending: "COD (Pending)",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

function orderStatusEmoji(status: string): string {
  return STATUS_EMOJI[status.toLowerCase()] ?? "📋";
}

function orderStatusLabel(status: string): string {
  return STATUS_LABEL[status.toLowerCase()] ?? status;
}

function paymentLabel(method: string, paymentStatus: string): string {
  if (method === "cod") return "Cash on Delivery";
  const label = PAYMENT_LABEL[paymentStatus.toLowerCase()];
  return label ? `Online (${label})` : "Online Payment";
}

function paymentEmoji(paymentStatus: string): string {
  return PAYMENT_EMOJI[paymentStatus.toLowerCase()] ?? "💳";
}

export function buildOrderCard(order: CustomerOrderDetailed): string {
  const lines: string[] = [];

  lines.push(`${orderStatusEmoji(order.orderStatus)} Order #${order.orderNumber}`);
  lines.push("");

  const firstItem = order.items[0];
  if (firstItem) {
    const itemLine = order.items.length === 1
      ? firstItem.title
      : `${firstItem.title} +${order.items.length - 1} more`;
    lines.push(`🛍 ${itemLine}`);
  }

  lines.push(`${paymentEmoji(order.paymentStatus)} ${paymentLabel(order.paymentMethod, order.paymentStatus)}`);
  lines.push(`${orderStatusEmoji(order.orderStatus)} Status: ${orderStatusLabel(order.orderStatus)}`);
  lines.push(`💰 Total: ${formatInr(order.total)}`);

  if (order.discountAmount > 0) {
    lines.push(`🏷 Discount: -${formatInr(order.discountAmount)}`);
  }

  lines.push(`📅 ${formatDate(order.createdAt)}`);

  const trackUrl = `${getAppUrl()}/order/track/${encodeURIComponent(order.orderNumber)}`;
  lines.push("");
  lines.push(`Tracking: ${trackUrl}`);

  if (order.isCancellable) {
    lines.push("");
    lines.push("I can also help cancel this order. Reply with: cancel order");
  }

  return lines.join("\n");
}

export function buildOrderCardWithImage(order: CustomerOrderDetailed): {
  caption: string;
  imageUrl: string | null;
} {
  let imageUrl: string | null = null;

  for (const item of order.items) {
    if (item.imageUrl) {
      imageUrl = item.imageUrl;
      break;
    }
  }

  return {
    caption: buildOrderCard(order),
    imageUrl,
  };
}

export function buildOrderListMessage(
  orders: CustomerOrderDetailed[],
  customerName: string | null
): string {
  const lines: string[] = [];
  const firstName = (customerName ?? "").split(/\s+/)[0] || "there";

  if (orders.length === 0) {
    lines.push(`I checked your account, ${firstName}, and there are no orders linked yet.`);
    lines.push("");
    lines.push("Tell me what you are looking for - watches, shoes, casual, formal, or luxury - and I can suggest options.");
    return lines.join("\n");
  }

  lines.push(`╔══════════════════════════════╗`);
  lines.push(`║  👑 YOUR ORDERS — VRIXO      ║`);
  lines.push(`╚══════════════════════════════╝`);
  lines.push("");
  lines.push(`${orders.length} order${orders.length === 1 ? "" : "s"} linked to your account, ${firstName}.`);
  lines.push("");

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const firstItem = o.items[0];
    const itemSummary = firstItem
      ? o.items.length === 1
        ? firstItem.title
        : `${firstItem.title} +${o.items.length - 1}`
      : "";

    lines.push(`┌─ ${orderStatusEmoji(o.orderStatus)} *#${o.orderNumber}*`);
    if (itemSummary) lines.push(`│  🛍 ${itemSummary}`);
    lines.push(`│  💰 ${formatInr(o.total)} • ${orderStatusLabel(o.orderStatus)} • ${formatDate(o.createdAt)}`);
    if (o.paymentMethod === "cod") {
      lines.push(`│  💵 Cash on Delivery`);
    } else {
      lines.push(`│  💳 ${paymentLabel(o.paymentMethod, o.paymentStatus)}`);
    }
    if (o.isCancellable) lines.push(`│  🔄 Reply "cancel ${o.orderNumber}"`);
    lines.push(`└────────────────────────`);
    lines.push("");
  }

  lines.push("✨ *Need help?* Just reply with the order number or ask anything.");
  return lines.join("\n");
}

export function buildCancellableOrdersMessage(
  orders: CustomerOrderDetailed[],
  customerName: string | null
): string {
  const firstName = (customerName ?? "").split(/\s+/)[0] || "there";
  const cancellable = orders.filter((o) => o.isCancellable);

  if (cancellable.length === 0) {
    return `I checked your orders, ${firstName}. None can be cancelled right now because cancellation is available only for Pending or Confirmed orders. If an order is already shipped, I can help with return options after delivery.`;
  }

  const lines: string[] = [];
  lines.push(`I can help with that, ${firstName}. I found ${cancellable.length} eligible order${cancellable.length === 1 ? "" : "s"} for cancellation.`);
  lines.push("");

  for (const o of cancellable) {
    const firstItem = o.items[0];
    const itemSummary = firstItem
      ? o.items.length === 1
        ? firstItem.title
        : `${firstItem.title} +${o.items.length - 1}`
      : "";

    lines.push(`${orderStatusEmoji(o.orderStatus)} *#${o.orderNumber}*`);
    if (itemSummary) lines.push(`   🛍 ${itemSummary}`);
    lines.push(`   ${formatInr(o.total)} • ${formatDate(o.createdAt)}`);
    lines.push(`   Reply "cancel ${o.orderNumber}" to cancel`);
    lines.push("");
  }

  lines.push("Which one would you like to cancel?");
  return lines.join("\n");
}

export function buildCancellationConfirmation(order: CustomerOrderDetailed): string {
  const lines: string[] = [];

  lines.push("✅ *Order Cancelled Successfully*");
  lines.push("");
  lines.push(`Your order #${order.orderNumber} has been cancelled.`);
  lines.push("");

  if (order.paymentMethod === "cod") {
    lines.push("No charges were made as this was a Cash on Delivery order.");
  } else if (order.paymentStatus === "paid") {
    lines.push(`Your refund of ${formatInr(order.total)} will be processed within 3-5 business days to your original payment method.`);
  }

  lines.push("");
  lines.push("You can check your cancelled orders anytime by replying 'my orders'.");
  lines.push("");

  lines.push("Is there anything else I can help you with?");

  return lines.join("\n");
}

export function buildCancellationFailed(orderNumber: string, reason: string): string {
  return [
    `I checked order #${orderNumber}, but I could not cancel it right now.`,
    "",
    reason,
    "",
    "Reply with the issue and I will guide the next step.",
  ].join("\n");
}

export function buildOrderNotFound(orderNumber: string): string {
  return [
    `I checked your account, but I could not find order #${orderNumber}.`,
    "",
    "Please check the order number and try again.",
    "Reply 'my orders' to see all your orders.",
  ].join("\n");
}

export function buildCustomerProfileSummary(context: CustomerContext): string {
  const lines: string[] = [];
  const firstName = (context.name ?? "").split(/\s+/)[0] || "Valued Customer";

  lines.push(`╔══════════════════════════════╗`);
  lines.push(`║  👑  VRIXO — YOUR PROFILE    ║`);
  lines.push(`╚══════════════════════════════╝`);
  lines.push("");

  lines.push(`✨ Welcome, *${context.name ?? "Valued Customer"}*`);
  lines.push("");

  lines.push(`📱 *Registered:* +91${context.phone ?? "N/A"}`);
  lines.push("");
  if (context.customerSegment) {
    lines.push(`🏆 *Segment:* ${context.customerSegment}`);
  }
  if (context.ltv !== null && context.ltv !== undefined) {
    lines.push(`💰 *Lifetime Spend:* ${formatInr(context.ltv)}`);
  }

  const activeCount = context.activeOrders.length;
  const deliveredCount = context.orders.filter((o) => o.orderStatus === "delivered").length;
  const cancelledCount = context.cancelledOrders.length;

  lines.push("");
  lines.push(`📊 *Order Summary*`);
  lines.push(`   Total Orders: ${context.orderCount}`);
  lines.push(`   Active: ${activeCount}`);
  lines.push(`   Delivered: ${deliveredCount}`);
  lines.push(`   Cancelled: ${cancelledCount}`);

  if (context.cartItemCount > 0) {
    lines.push("");
    lines.push(`🛒 *Cart*`);
    lines.push(`   ${context.cartItemCount} item${context.cartItemCount === 1 ? "" : "s"} • ${formatInr(context.cartTotal)}`);
    lines.push(`   Type "checkout" to place your order.`);
  }

  if (context.pendingPayments.length > 0) {
    lines.push("");
    lines.push(`⚠️ *Pending Payments*`);
    lines.push(`   ${context.pendingPayments.length} order${context.pendingPayments.length === 1 ? "" : "s"} need attention.`);
    lines.push(`   Reply "payment" to resolve.`);
  }

  lines.push("");
  if (context.orders.length > 0) {
    lines.push(`📦 *Recent Orders*`);
    lines.push("");
    const recent = context.orders.slice(0, 3);
    for (const o of recent) {
      const firstItem = o.items[0];
      const itemSummary = firstItem
        ? o.items.length === 1
          ? firstItem.title
          : `${firstItem.title} +${o.items.length - 1}`
        : "Order";
      lines.push(`┌─ ${orderStatusEmoji(o.orderStatus)} *#${o.orderNumber}*`);
      lines.push(`│  🛍 ${itemSummary}`);
      lines.push(`│  💰 ${formatInr(o.total)} • ${orderStatusLabel(o.orderStatus)}`);
      if (o.isCancellable) lines.push(`│  🔄 Reply "cancel ${o.orderNumber}"`);
      lines.push(`└────────────────────────`);
      lines.push("");
    }
    if (context.orders.length > 3) {
      lines.push(`... and ${context.orders.length - 3} more. Reply "my orders" for full list.`);
      lines.push("");
    }
  }

  lines.push("💎 *24/7 Concierge* — Reply with anything you need.");
  return lines.join("\n");
}
