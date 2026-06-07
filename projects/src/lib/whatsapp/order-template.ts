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
  deliveryAddress?: string;
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
  return paymentStatus.toLowerCase() === "paid" ? "Online - Paid" : "Online";
}

function resolveStatusLabel(
  paymentMethod: "cod" | "online",
  paymentStatus: string,
  orderStatus: string
) {
  if (paymentMethod === "online" && paymentStatus.toLowerCase() === "paid") {
    return "Processing";
  }

  if (paymentMethod === "cod") return "Processing";

  return orderStatus || "Processing";
}

export function buildOrderTrackUrl(orderNumber: string) {
  const appUrl = getAppUrl();
  return `${appUrl}/order/track/${encodeURIComponent(orderNumber)}`;
}

export function buildPremiumOrderWhatsAppMessage(input: OrderWhatsAppTemplateInput) {
  const firstName = String(input.customerName ?? "there").trim().split(/\s+/)[0] || "there";
  const productLine =
    input.productNames.length > 140
      ? `${input.productNames.slice(0, 140)}...`
      : input.productNames || `${BRAND_NAME} product`;
  const trackUrl = buildOrderTrackUrl(input.orderNumber);
  const addressBlock = input.deliveryAddress ? `📍 Delivery Address: ${input.deliveryAddress}` : "";

  return [
    `🎉 Order Confirmed - ${BRAND_NAME}`,
    "",
    `Hi ${firstName},`,
    "",
    `Your order #${input.orderNumber} has been confirmed successfully.`,
    "",
    `🛍 Items: ${productLine}`,
    `💳 Payment: ${resolvePaymentLabel(input.paymentMethod, input.paymentStatus)}`,
    addressBlock,
    `📦 Status: ${resolveStatusLabel(input.paymentMethod, input.paymentStatus, input.orderStatus)}`,
    "🚚 Delivery ETA: 3-5 Days",
    `💰 Total: ${formatInr(input.totalAmount)}`,
    "",
    `Thank you for shopping with ${BRAND_NAME}.`,
    "Luxury delivered to your doorstep.",
    "",
    "Track your order:",
    trackUrl,
    "",
    "Need help? Reply to this message anytime."
  ].filter(Boolean).join("\n");
}

export function buildAdminOrderWhatsAppMessage(input: OrderWhatsAppTemplateInput & { phone: string }) {
  return [
    "🚨 New Order Alert",
    "",
    `Customer: ${input.customerName}`,
    `Phone: ${input.phone}`,
    `Amount: ${formatInr(input.totalAmount)}`,
    `Payment: ${resolvePaymentLabel(input.paymentMethod, input.paymentStatus)}`,
    `Order: #${input.orderNumber}`
  ].join("\n");
}

export function buildOrderWhatsAppCaption(
  payload: OrderWhatsAppTemplateInput & { deliveryAddress?: string }
) {
  return buildPremiumOrderWhatsAppMessage(payload);
}
