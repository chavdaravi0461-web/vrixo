import { getOptionalServerEnv } from "@/lib/env/server";
import { BRAND_NAME } from "@/lib/constants";
import {
  buildAdminOrderWhatsAppMessage,
  buildPremiumOrderWhatsAppMessage
} from "@/lib/whatsapp/order-template";
import { formatWhatsAppPhone, toWhatsAppCloudRecipient } from "@/lib/whatsapp/phone";
import { whatsappLog } from "@/lib/whatsapp/logger";
import {
  isRetryableWhatsAppError,
  toWhatsAppErrorMessage,
  WhatsAppDispatchError
} from "@/lib/whatsapp/errors";
import { fetchWithTimeout, safeJson } from "@/lib/request-timeout";
import { withProtection } from "@/lib/dependency-protection";
import { isShuttingDown } from "@/lib/graceful-shutdown";
import { logInfo, logWarn, logError } from "@/lib/observability";

export { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
export {
  buildAdminOrderWhatsAppMessage,
  buildPremiumOrderWhatsAppMessage,
  buildOrderTrackUrl
} from "@/lib/whatsapp/order-template";

type WhatsAppServerEnv = {
  WHATSAPP_CLOUD_API_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ADMIN_NUMBER: string;
  WHATSAPP_TEMPLATE_LANGUAGE: string;
  WHATSAPP_GRAPH_API_VERSION: string;
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

export type MetaWhatsAppResponse = {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; type?: string; code?: number; fbtrace_id?: string };
};

const RETRYABLE_META_ERROR_CODES = new Set([
  1, 2, 4, 17, 32, 613, 80007, 130429, 131000, 131016, 131053
]);

function isRetryableMetaFailure(status: number, code?: number) {
  return status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500 ||
    (typeof code === "number" && RETRYABLE_META_ERROR_CODES.has(code));
}

export type WhatsAppSendResult = {
  sent: boolean;
  provider: "whatsapp";
  error: string | null;
  adminNotified: boolean;
  customerMessageId?: string;
  adminMessageId?: string;
  customerResponse?: MetaWhatsAppResponse | null;
  adminResponse?: MetaWhatsAppResponse | null;
};

const WHATSAPP_SEND_MAX_ATTEMPTS = 3;
const WHATSAPP_RETRY_BASE_MS = 1000;

export function getWhatsAppServerEnv(): WhatsAppServerEnv {
  const env = getOptionalServerEnv();

  return {
    WHATSAPP_CLOUD_API_TOKEN: env.WHATSAPP_CLOUD_API_TOKEN || env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ADMIN_NUMBER: env.WHATSAPP_ADMIN_NUMBER,
    WHATSAPP_TEMPLATE_LANGUAGE: env.WHATSAPP_TEMPLATE_LANGUAGE,
    WHATSAPP_GRAPH_API_VERSION: env.WHATSAPP_GRAPH_API_VERSION
  };
}

function getOrderTemplateName(): string {
  const name = getOptionalServerEnv().WHATSAPP_ORDER_TEMPLATE_NAME;
  return name.trim() || "order_confirmation_vrixo";
}

function getMessagesEndpoint(phoneNumberId: string) {
  const { WHATSAPP_GRAPH_API_VERSION } = getWhatsAppServerEnv();
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
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
    paymentStatus: payload.paymentStatus,
    deliveryAddress: payload.deliveryAddress
  });
}

const WHATSAPP_CIRCUIT_FALLBACK: Response = new Response(
  JSON.stringify({ error: { message: "WhatsApp API circuit open — degraded", code: 503 } }),
  { status: 503, headers: { "Content-Type": "application/json" } }
);

async function circuitProtectedFetch(url: string, options: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  if (isShuttingDown()) {
    throw new WhatsAppDispatchError("Server shutting down", "shutting_down", true);
  }
  return withProtection("whatsapp-cloud-api", () => fetchWithTimeout(url, options as any, timeoutMs), WHATSAPP_CIRCUIT_FALLBACK);
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
  whatsappLog("info", "send_image.started", {
    toSuffix: toWhatsAppCloudRecipient(to).slice(-4),
    imageUrl: imageUrl.slice(0, 80)
  });
  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsAppCloudRecipient(to),
      type: "image",
      image: { link: imageUrl, caption }
    })
  }, 8000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    whatsappLog("error", "send_image.failed", {
      status: response.status,
      error: payload?.error?.message
    });
    throw new WhatsAppDispatchError(
      payload?.error?.message || `WhatsApp image API failed (${response.status}).`,
      "whatsapp_image_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  whatsappLog("info", "send_image.sent", {
    status: response.status,
    toSuffix: toWhatsAppCloudRecipient(to).slice(-4),
    messageId: payload?.messages?.[0]?.id ?? null
  });

  return payload;
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
  const toSuffix = toWhatsAppCloudRecipient(to).slice(-4);
  whatsappLog("info", "send_text.started", { toSuffix, textLength: text.length });

  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsAppCloudRecipient(to),
      type: "text",
      text: { body: text }
    })
  }, 8000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `WhatsApp text API failed (${response.status}).`;
    whatsappLog("error", "send_text.failed", {
      status: response.status,
      error: errorMsg,
      code: payload?.error?.code,
      type: payload?.error?.type,
      fbtrace_id: payload?.error?.fbtrace_id
    });
    logError("whatsapp.send_text.failed", {
      toSuffix,
      status: response.status,
      error: errorMsg,
      code: payload?.error?.code
    });
    throw new WhatsAppDispatchError(
      errorMsg,
      "whatsapp_text_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  const messageId = payload?.messages?.[0]?.id ?? null;
  logInfo("whatsapp.send_text.sent", { toSuffix, status: response.status, messageId });
  whatsappLog("info", "send_text.sent", { toSuffix, status: response.status, messageId });

  return payload;
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
  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsAppCloudRecipient(to),
      type: "document",
      document: { link: documentUrl, filename: filename || "invoice.pdf" }
    })
  }, 10000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      payload?.error?.message || `WhatsApp document API failed (${response.status}).`,
      "whatsapp_document_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  return payload;
}

export type InteractiveButton = {
  type: "reply";
  reply: { id: string; title: string };
};

export type ListSection = {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

export async function sendWhatsAppInteractiveButtons({
  to,
  text,
  buttons,
  token,
  phoneNumberId,
  header,
  footer,
}: {
  to: string;
  text: string;
  buttons: InteractiveButton[];
  token: string;
  phoneNumberId: string;
  header?: string;
  footer?: string;
}) {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppCloudRecipient(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: { buttons },
    },
  };
  if (header) (body.interactive as Record<string, unknown>).header = { type: "text", text: header };
  if (footer) (body.interactive as Record<string, unknown>).footer = { type: "text", text: footer };

  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 8000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      payload?.error?.message || `WhatsApp interactive button API failed (${response.status}).`,
      "whatsapp_interactive_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  return payload;
}

export async function sendWhatsAppListMessage({
  to,
  text,
  buttonText,
  sections,
  token,
  phoneNumberId,
  header,
  footer,
}: {
  to: string;
  text: string;
  buttonText: string;
  sections: ListSection[];
  token: string;
  phoneNumberId: string;
  header?: string;
  footer?: string;
}) {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppCloudRecipient(to),
    type: "interactive",
    interactive: {
      type: "list",
      header: header ? { type: "text", text: header } : undefined,
      body: { text },
      footer: footer ? { type: "text", text: footer } : undefined,
      action: {
        button: buttonText,
        sections,
      },
    },
  };

  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 8000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      payload?.error?.message || `WhatsApp list message API failed (${response.status}).`,
      "whatsapp_list_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  return payload;
}

export function buildOrderTemplateComponents(payload: WhatsAppCustomerPayload) {
  const customerName = String(payload.customerName ?? "Customer").trim() || "Customer";
  const productNames = String(payload.productNames ?? "Vrixo product").trim() || "Vrixo product";
  const deliveryAddress =
    String(payload.deliveryAddress ?? "Delivery address saved with your order").trim() ||
    "Delivery address saved with your order";
  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(payload.totalAmount)));
  const paymentLabel = payload.paymentMethod === "cod" ? "Cash on Delivery" : "Online";
  return {
    body: [
      { type: "text", text: customerName },
      { type: "text", text: payload.orderNumber },
      { type: "text", text: productNames },
      { type: "text", text: paymentLabel },
      { type: "text", text: deliveryAddress },
      { type: "text", text: amount }
    ]
  };
}

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  bodyParameters,
  buttonParameters,
  token,
  phoneNumberId
}: {
  to: string;
  templateName: string;
  bodyParameters: Array<{ type: string; text: string }>;
  buttonParameters?: Array<{ type: string; url: string; index: number }>;
  token: string;
  phoneNumberId: string;
}) {
  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: bodyParameters
    }
  ];

  if (buttonParameters && buttonParameters.length > 0) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: buttonParameters
    });
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toWhatsAppCloudRecipient(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: getWhatsAppServerEnv().WHATSAPP_TEMPLATE_LANGUAGE },
      components
    }
  };

  const response = await circuitProtectedFetch(getMessagesEndpoint(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, 8000);
  const payload = await safeJson<MetaWhatsAppResponse>(response);

  if (!response.ok) {
    throw new WhatsAppDispatchError(
      payload?.error?.message || `WhatsApp template API failed (${response.status}).`,
      "whatsapp_template_failed",
      isRetryableMetaFailure(response.status, payload?.error?.code)
    );
  }

  whatsappLog("info", "send_template.sent", {
    status: response.status,
    toSuffix: toWhatsAppCloudRecipient(to).slice(-4),
    templateName,
    messageId: payload?.messages?.[0]?.id ?? null
  });

  return payload;
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
  const responses: Array<MetaWhatsAppResponse | null> = [];
  for (const product of products) {
    const text =
      `${product.title}\nPrice: INR ${product.price}\n${product.link}` + (caption ? `\n\n${caption}` : "");
    responses.push(await sendWhatsAppImageMessage({ to, caption: text, imageUrl: product.imageUrl, token, phoneNumberId }));
  }

  return responses;
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

export async function sendOrderConfirmationWhatsApp(
  payload: WhatsAppCustomerPayload
): Promise<WhatsAppSendResult> {
  whatsappLog("info", "order_confirmation.started", {
    orderNumber: payload.orderNumber,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus,
    phoneSuffix: payload.customerPhone.slice(-4),
    hasImage: Boolean(payload.productImageUrl && !payload.productImageUrl.endsWith(".svg"))
  });

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

  const adminText = buildAdminOrderWhatsAppMessage({
    customerName: payload.customerName,
    phone: customerPhone,
    orderNumber: payload.orderNumber,
    productNames: payload.productNames,
    totalAmount: payload.totalAmount,
    orderStatus: payload.orderStatus,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus
  });
  let adminNotified = false;
  let customerResponse: MetaWhatsAppResponse | null = null;
  let adminResponse: MetaWhatsAppResponse | null = null;

  const templateName = getOrderTemplateName();
  try {
    const components = buildOrderTemplateComponents(payload);
    customerResponse = await withWhatsAppRetries("order_confirmation.template", () =>
      sendWhatsAppTemplateMessage({
        to: customerPhone,
        templateName,
        bodyParameters: components.body,
        token: env.WHATSAPP_CLOUD_API_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
      })
    );
  } catch (templateError) {
    const templateErrMsg = toWhatsAppErrorMessage(templateError);
    logWarn("whatsapp.order_confirmation.template_fallback", {
      orderNumber: payload.orderNumber,
      error: templateErrMsg,
      phoneSuffix: customerPhone.slice(-4)
    });

    const customerText = buildPremiumOrderWhatsAppMessage({
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      productNames: payload.productNames,
      totalAmount: payload.totalAmount,
      orderStatus: payload.orderStatus,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      deliveryAddress: payload.deliveryAddress
    });

    try {
      customerResponse = await withWhatsAppRetries("order_confirmation.text_fallback", () =>
        sendWhatsAppTextMessage({
          to: customerPhone,
          text: customerText,
          token: env.WHATSAPP_CLOUD_API_TOKEN,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
        })
      );
      logInfo("whatsapp.order_confirmation.text_fallback_sent", {
        orderNumber: payload.orderNumber,
        phoneSuffix: customerPhone.slice(-4)
      });
    } catch (textError) {
      const message = toWhatsAppErrorMessage(textError);
      logError("whatsapp.order_confirmation.all_failed", {
        orderNumber: payload.orderNumber,
        templateError: templateErrMsg,
        textError: message,
        phoneSuffix: customerPhone.slice(-4)
      });

      if (adminPhone) {
        try {
          adminResponse = await sendWhatsAppTextMessage({
            to: adminPhone,
            text: `${BRAND_NAME} WhatsApp failed for order ${payload.orderNumber}. Customer ***${customerPhone.slice(-4)}. Template: ${templateErrMsg}. Text: ${message}`,
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
        adminNotified,
        customerResponse,
        adminResponse,
        adminMessageId: extractMetaMessageId(adminResponse)
      };
    }
  }

  if (adminPhone) {
    try {
      adminResponse = await sendWhatsAppTextMessage({
        to: adminPhone,
        text: adminText,
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
    adminNotified,
    customerMessageId: extractMetaMessageId(customerResponse),
    adminMessageId: extractMetaMessageId(adminResponse),
    customerResponse,
    adminResponse
  };
}

function extractMetaMessageId(response: MetaWhatsAppResponse | null) {
  return response?.messages?.[0]?.id;
}
