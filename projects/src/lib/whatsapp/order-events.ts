import "server-only";
import { formatWhatsAppPhone, toWhatsAppCloudRecipient } from "@/lib/whatsapp/phone";
import { hasWhatsAppServerEnv, getWhatsAppServerEnv, sendWhatsAppTextMessage, sendWhatsAppTemplateMessage } from "@/lib/whatsapp";
import { getAppUrl } from "@/lib/app-url";
import { BRAND_NAME } from "@/lib/constants";

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(amount)));
}

function getFirstItemName(items: Array<Record<string, unknown>>): string {
  const first = items?.[0];
  return first ? String(first.title ?? "Item") : "Item";
}

type OrderEventInput = {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  orderStatus: string;
  paymentMethod: "cod" | "online";
  paymentStatus: string;
  totalAmount: number;
  items: Array<Record<string, unknown>>;
};

async function sendWhatsApp(to: string, text: string) {
  const env = getWhatsAppServerEnv();
  if (!hasWhatsAppServerEnv()) return;
  await sendWhatsAppTextMessage({
    to,
    text,
    token: env.WHATSAPP_CLOUD_API_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  }).catch(() => {});
}

export async function sendOrderStatusWhatsApp(input: OrderEventInput) {
  const phone = formatWhatsAppPhone(input.customerPhone);
  if (!phone) return;

  const firstName = input.customerName.split(/\s+/)[0] || "there";
  const trackUrl = `${getAppUrl()}/order/track/${encodeURIComponent(input.orderNumber)}`;
  const itemName = getFirstItemName(input.items);

  const messages: Record<string, string> = {
    confirmed: [
      `✅ *Order Confirmed*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `Your order #${input.orderNumber} has been confirmed.`,
      `🛍 ${itemName}`,
      `💰 ${formatInr(input.totalAmount)}`,
      `💳 ${input.paymentMethod === "cod" ? "Cash on Delivery" : "Paid Online"}`,
      ``,
      `We'll notify you when it's shipped.`,
      ``,
      `Track: ${trackUrl}`,
    ].join("\n"),

    shipped: [
      `🚚 *Order Shipped*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `Great news! Your order #${input.orderNumber} is on its way.`,
      `🛍 ${itemName}`,
      `💰 ${formatInr(input.totalAmount)}`,
      ``,
      `Track your shipment: ${trackUrl}`,
      ``,
      `Thank you for shopping with ${BRAND_NAME}!`,
    ].join("\n"),

    delivered: [
      `🎉 *Order Delivered*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `Your order #${input.orderNumber} has been delivered.`,
      `🛍 ${itemName}`,
      ``,
      `We hope you love it! If you need anything, reply to this message.`,
      ``,
      `Love the product? Share your experience — reply with a review!`,
    ].join("\n"),

    cancelled: [
      `❌ *Order Cancelled*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `Your order #${input.orderNumber} has been cancelled.`,
      `🛍 ${itemName}`,
      `💰 ${formatInr(input.totalAmount)}`,
      ``,
      input.paymentMethod === "cod"
        ? "No charges were made as this was a Cash on Delivery order."
        : "Your refund will be processed within 3-5 business days.",
      ``,
      `Need help? Reply to this message.`,
    ].join("\n"),

    return_approved: [
      `🔄 *Return Approved*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `Your return request for order #${input.orderNumber} has been approved.`,
      ``,
      `We'll share pickup details shortly.`,
      ``,
      `Thank you for your patience.`,
    ].join("\n"),

    refund_processed: [
      `💰 *Refund Processed*`,
      ``,
      `Hi ${firstName},`,
      ``,
      `The refund for order #${input.orderNumber} of ${formatInr(input.totalAmount)} has been processed.`,
      ``,
      `It should reflect in your account within 3-5 business days.`,
      ``,
      `Thank you for your patience.`,
    ].join("\n"),
  };

  const message = messages[input.orderStatus];
  if (!message) return;

  await sendWhatsApp(phone, message);
}

export async function sendWhatsAppTicketCreated(
  phone: string,
  ticketNumber: string,
  subject: string
) {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return;

  const text = [
    `🎫 *Support Ticket Created*`,
    ``,
    `Your ticket #${ticketNumber} has been received.`,
    `📋 ${subject}`,
    ``,
    `Our team will get back to you shortly.`,
    `Reply to this message for faster support.`,
  ].join("\n");

  await sendWhatsApp(formatted, text);
}

export async function sendWhatsAppReturnRequested(
  phone: string,
  orderNumber: string
) {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return;

  const text = [
    `🔄 *Return Request Received*`,
    ``,
    `Your return request for order #${orderNumber} has been submitted.`,
    ``,
    `We'll review it and get back to you within 24 hours.`,
  ].join("\n");

  await sendWhatsApp(formatted, text);
}

export async function sendAdminAlertWhatsApp(
  message: string
) {
  const env = getWhatsAppServerEnv();
  const adminPhone = formatWhatsAppPhone(env.WHATSAPP_ADMIN_NUMBER || "");
  if (!adminPhone || !hasWhatsAppServerEnv()) return;

  await sendWhatsAppTextMessage({
    to: adminPhone,
    text: `🔔 *${BRAND_NAME} Alert*\n\n${message}`,
    token: env.WHATSAPP_CLOUD_API_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  }).catch(() => {});
}
