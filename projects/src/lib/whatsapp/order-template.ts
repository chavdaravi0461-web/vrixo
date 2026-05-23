import { BRAND_NAME } from "@/lib/constants";
import { getAppUrl } from "@/lib/app-url";

export type OrderWhatsAppTemplateInput = {
  customerName: string;
  orderNumber: string;
  productNames: string;
  totalAmount: number;
  orderStatus: string;
  paymentMethod: "cod" | "online";
  paymentStatus: string;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(amount)));
}

function resolvePaymentLabel(paymentMethod: "cod" | "online", paymentStatus: string) {
  if (paymentMethod === "cod") return "Cash on Delivery (COD)";
  const normalized = paymentStatus.toLowerCase();
  if (normalized === "paid") return "Online — Paid";
  return "Online";
}

function resolveStatusLabel(
  paymentMethod: "cod" | "online",
  paymentStatus: string,
  orderStatus: string
) {
  const normalizedPayment = paymentStatus.toLowerCase();
  const normalizedOrder = orderStatus.toLowerCase();

  if (paymentMethod === "online" && normalizedPayment === "paid") {
    return "Confirmed";
  }

  if (paymentMethod === "cod") {
    if (normalizedOrder.includes("confirm")) return "Confirmed";
    return "Placed — Awaiting COD confirmation";
  }

  return orderStatus || "Processing";
}

function resolveHeadline(paymentMethod: "cod" | "online", paymentStatus: string) {
  if (paymentMethod === "online" && paymentStatus.toLowerCase() === "paid") {
    return "✨ Your order has been confirmed successfully!";
  }

  if (paymentMethod === "cod") {
    return "✨ Your COD order has been placed successfully!";
  }

  return "✨ Thank you for your order!";
}

function resolveDispatchLine(paymentMethod: "cod" | "online", paymentStatus: string) {
  if (paymentMethod === "cod") {
    return "We will confirm your COD order shortly, then prepare it for dispatch.";
  }

  if (paymentStatus.toLowerCase() === "paid") {
    return "We're preparing your order for dispatch.";
  }

  return "We will update you once payment is confirmed.";
}

export function buildOrderTrackUrl(orderNumber: string) {
  const appUrl = getAppUrl();
  return `${appUrl}/order/track/${encodeURIComponent(orderNumber)}`;
}

/** Premium luxury-style WhatsApp body (text + image caption). */
export function buildPremiumOrderWhatsAppMessage(input: OrderWhatsAppTemplateInput) {
  const firstName = String(input.customerName ?? "there").trim().split(/\s+/)[0] || "there";
  const productLine =
    input.productNames.length > 120
      ? `${input.productNames.slice(0, 120)}...`
      : input.productNames || `${BRAND_NAME} product`;
  const trackUrl = buildOrderTrackUrl(input.orderNumber);

  return [
    resolveHeadline(input.paymentMethod, input.paymentStatus),
    "",
    `Hi ${firstName},`,
    `Thank you for shopping with ${BRAND_NAME}.`,
    "",
    `🛍 Order ID: #${input.orderNumber}`,
    `💳 Payment: ${resolvePaymentLabel(input.paymentMethod, input.paymentStatus)}`,
    `📦 Status: ${resolveStatusLabel(input.paymentMethod, input.paymentStatus, input.orderStatus)}`,
    `💰 Total: ${formatInr(input.totalAmount)}`,
    "",
    `🛒 Items: ${productLine}`,
    "",
    resolveDispatchLine(input.paymentMethod, input.paymentStatus),
    "",
    "Track your order:",
    trackUrl,
    "",
    "Need help?",
    "Reply to this message anytime."
  ].join("\n");
}

/** @deprecated Use buildPremiumOrderWhatsAppMessage — kept for backward compatibility. */
export function buildOrderWhatsAppCaption(
  payload: OrderWhatsAppTemplateInput & { deliveryAddress?: string }
) {
  return buildPremiumOrderWhatsAppMessage(payload);
}
