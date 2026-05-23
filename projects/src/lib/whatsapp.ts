import { getOptionalServerEnv } from "@/lib/env/server";
import { getAppUrl } from "@/lib/app-url";
import { BRAND_NAME } from "@/lib/constants";
import { buildPremiumOrderWhatsAppMessage } from "@/lib/whatsapp/order-template";
import { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
import { whatsappLog } from "@/lib/whatsapp/logger";
import { isRetryableWhatsAppError, toWhatsAppErrorMessage, WhatsAppDispatchError } from "@/lib/whatsapp/errors";

export { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
export { buildPremiumOrderWhatsAppMessage, buildOrderTrackUrl } from "@/lib/whatsapp/order-template";

type WhatsAppServerEnv = {
  WHATSAPP_CLOUD_API_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ADMIN_NUMBER: string;
};

export type WhatsAppCustomerPayload = {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  productNames: string;
  totalQty: number;
  totalAmount: number;
  orderStatus: string;
  paymentMethod: "cod" | "online";
  paymentStatus: string;
  productImageUrl: string;
  deliveryAddress: string;
};

export type WhatsAppSendResult = {
  sent: boolean;
  provider: "whatsapp";
  error: string | null;
  adminNotified: boolean;
};

const WHATSAPP_SEND_MAX_ATTEMPTS = 3;
const WHATSAPP_RETRY_BASE_MS = 1000;

export function getWhatsAppServerEnv(): WhatsAppServerEnv {
  const env = getOptionalServerEnv();

  return {
    WHATSAPP_CLOUD_API_TOKEN: env.WHATSAPP_CLOUD_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ADMIN_NUMBER: env.WHATSAPP_ADMIN_NUMBER
  };
}

export function hasWhatsAppServerEnv() {
  const env = getWhatsAppServerEnv();
  return Boolean(env.WHATSAPP_CLOUD_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function buildOrderWhatsAppCaption(payload: WhatsAppCustomerPayload) {
  return buildPremiumOrderWhatsAppMessage({
    customerName: payload.customerName,
    orderNumber: payload.orderNumber,
    productNames: payload.productNames,
    totalAmount: payload.totalAmount,
    orderStatus: payload.orderStatus,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus
  });
}

export async function sendWhatsAppImageMessage({
  to,
  caption,
  imageUrl,
  token,
  phoneNumberId
}: {
  to: string;
  caption: string;
  imageUrl: string;
  token: string;
  phoneNumberId: string;
}) {
  const response = await fetchWithTimeout(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption }
    })
  }, 8000);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      `WhatsApp image API failed (${response.status}).`,
      "whatsapp_image_failed",
      response.status >= 500 || response.status === 429
    );
  }

  return true;
}

export async function sendWhatsAppTextMessage({
  to,
  text,
  token,
  phoneNumberId
}: {
  to: string;
  text: string;
  token: string;
  phoneNumberId: string;
}) {
  const response = await fetchWithTimeout(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    })
  }, 8000);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      `WhatsApp text API failed (${response.status}).`,
      "whatsapp_text_failed",
      response.status >= 500 || response.status === 429
    );
  }

  return true;
}

export async function sendWhatsAppDocumentMessage({
  to,
  documentUrl,
  filename,
  token,
  phoneNumberId
}: {
  to: string;
  documentUrl: string;
  filename?: string;
  token: string;
  phoneNumberId: string;
}) {
  const response = await fetchWithTimeout(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { link: documentUrl, filename: filename || "invoice.pdf" }
    })
  }, 10000);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      `WhatsApp document API failed (${response.status}).`,
      "whatsapp_document_failed",
      response.status >= 500 || response.status === 429
    );
  }

  return true;
}

export async function sendWhatsAppProductCarousel({
  to,
  products,
  token,
  phoneNumberId,
  caption
}: {
  to: string;
  products: Array<{ title: string; price: number; imageUrl: string; link: string }>;
  token: string;
  phoneNumberId: string;
  caption?: string;
}) {
  for (const product of products) {
    const text =
      `${product.title}\nPrice: ₹${product.price}\n${product.link}` + (caption ? `\n\n${caption}` : "");
    await sendWhatsAppImageMessage({ to, caption: text, imageUrl: product.imageUrl, token, phoneNumberId });
  }

  return true;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withWhatsAppRetries<T>(label: string, task: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= WHATSAPP_SEND_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableWhatsAppError(error);
      whatsappLog(retryable ? "warn" : "error", `${label}.attempt_failed`, {
        attempt,
        retryable,
        error: toWhatsAppErrorMessage(error)
      });

      if (!retryable || attempt >= WHATSAPP_SEND_MAX_ATTEMPTS) {
        throw error;
      }

      await sleep(WHATSAPP_RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

/** Sends premium order confirmation (image + caption, text fallback). Order save must not depend on this. */
export async function sendOrderConfirmationWhatsApp(
  payload: WhatsAppCustomerPayload
): Promise<WhatsAppSendResult> {
  const env = getWhatsAppServerEnv();
  const customerPhone = formatWhatsAppPhone(payload.customerPhone);
  const adminPhone = formatWhatsAppPhone(env.WHATSAPP_ADMIN_NUMBER || "");

  if (!customerPhone) {
    return {
      sent: false,
      provider: "whatsapp",
      error: "Invalid customer phone number.",
      adminNotified: false
    };
  }

  if (!hasWhatsAppServerEnv()) {
    whatsappLog("warn", "order_confirmation.env_missing");
    return {
      sent: false,
      provider: "whatsapp",
      error: "WhatsApp Cloud API environment is not configured.",
      adminNotified: false
    };
  }

  const caption = buildOrderWhatsAppCaption(payload);
  const appUrl = getAppUrl();
  const imageUrl = payload.productImageUrl || `${appUrl}/placeholder-product.svg`;
  let adminNotified = false;

  try {
    await withWhatsAppRetries("order_confirmation.image", () =>
      sendWhatsAppImageMessage({
        to: customerPhone,
        caption,
        imageUrl,
        token: env.WHATSAPP_CLOUD_API_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
      })
    );
  } catch (imageError) {
    const imageMessage = toWhatsAppErrorMessage(imageError);

    try {
      await withWhatsAppRetries("order_confirmation.text_fallback", () =>
        sendWhatsAppTextMessage({
          to: customerPhone,
          text: caption,
          token: env.WHATSAPP_CLOUD_API_TOKEN,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
        })
      );
    } catch (textError) {
      const message = toWhatsAppErrorMessage(textError) || imageMessage;

      if (adminPhone) {
        try {
          await sendWhatsAppTextMessage({
            to: adminPhone,
            text: `${BRAND_NAME} | Failed WhatsApp for order ${payload.orderNumber}. Customer ***${customerPhone.slice(-4)}. Error: ${message}`,
            token: env.WHATSAPP_CLOUD_API_TOKEN,
            phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
          });
          adminNotified = true;
        } catch {
          adminNotified = false;
        }
      }

      return {
        sent: false,
        provider: "whatsapp",
        error: message,
        adminNotified
      };
    }
  }

  if (adminPhone) {
    try {
      await sendWhatsAppTextMessage({
        to: adminPhone,
        text: `${BRAND_NAME} | New order ${payload.orderNumber}. ${payload.customerName} (***${customerPhone.slice(-4)}). Total: ₹${payload.totalAmount}. Payment: ${payload.paymentMethod.toUpperCase()}.`,
        token: env.WHATSAPP_CLOUD_API_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
      });
      adminNotified = true;
    } catch {
      adminNotified = false;
    }
  }

  return {
    sent: true,
    provider: "whatsapp",
    error: null,
    adminNotified
  };
}
