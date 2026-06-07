import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getRequiredRazorpayServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { badRequest, serverError, tooManyRequests } from "@/lib/api-response";
import { securityLog } from "@/lib/security";
import { publishEvent } from "@/lib/event-bus";
import { logInfo, logWarn, logError, generateRequestId } from "@/lib/observability";
import { fetchWithTimeout, safeJson } from "@/lib/request-timeout";
import {
  dispatchOrderNotification,
  enqueueOrderConfirmationNotification
} from "@/lib/notification-queue";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
        amount?: number;
        amount_paid?: number;
        currency?: string;
      };
    };
  };
};

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  method?: string;
  amount?: number;
  currency?: string;
  error_description?: string;
  error_code?: string;
};

import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const requestId = generateRequestId();

  const rateLimit = await checkServerRateLimit(request, {
    key: "razorpay-webhook",
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    logWarn("webhook.rate_limited", { requestId });
    return tooManyRequests(rateLimit.retryAfter, request);
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logError("webhook.secret_missing", { requestId });
    return serverError("Webhook is temporarily unavailable.", "WEBHOOK_SECRET_MISSING", request);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  if (!safeEqual(expectedSignature, signature)) {
    securityLog("razorpay.webhook.signature_failed");
    logWarn("webhook.signature_invalid", { requestId });
    return badRequest("Invalid webhook signature.", "INVALID_SIGNATURE", request);
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return badRequest("Invalid webhook payload.", "INVALID_JSON", request);
  }

  const eventName = payload.event ?? "";
  const eventId = request.headers.get("x-razorpay-event-id")
    || `${eventName}:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;

  logInfo("webhook.received", { requestId, eventName, eventId });

  const supabase = createAdminClient();

  const duplicate = await hasWebhookEvent(supabase, eventId);
  if (duplicate) {
    logInfo("webhook.duplicate_ignored", { requestId, eventId });
    return NextResponse.json({ success: true, message: "Webhook already processed." });
  }

  publishEvent({
    type: "webhook.received",
    severity: "info",
    entityType: "razorpay",
    payload: { eventName, eventId, requestId }
  }).catch(() => undefined);

  if (eventName.includes("payment.failed") || eventName === "order.payment_failed") {
    return markWebhookPaymentFailed(supabase, payload, eventId, eventName, requestId);
  }

  if (!eventName.includes("payment.captured") && eventName !== "order.paid") {
    await recordWebhookEvent(supabase, eventId, eventName, payload);
    logInfo("webhook.ignored_event", { requestId, eventName });
    return NextResponse.json({ success: true, message: "Webhook event ignored." });
  }

  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? order?.id;
  const razorpayPaymentId = payment?.id;

  if (!razorpayOrderId || !razorpayPaymentId) {
    logWarn("webhook.missing_ids", { requestId, eventName });
    return badRequest("Invalid webhook payload.", "MISSING_IDS", request);
  }

  const { data: paymentRow, error: paymentQueryError } = await supabase
    .from("payments")
    .select("order_id, amount, currency, status")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .maybeSingle();

  if (paymentQueryError || !paymentRow) {
    logWarn("webhook.order_not_found", { requestId, razorpayOrderId });
    return badRequest("Invalid webhook payload.", "ORDER_NOT_FOUND", request);
  }

  const { data: internalOrder, error: orderQueryError } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_method, payment_status, order_status, razorpay_payment_id, whatsapp_status, customer_name, customer_phone, user_id, shipping_address")
    .eq("id", paymentRow.order_id)
    .maybeSingle();

  if (orderQueryError || !internalOrder) {
    logWarn("webhook.internal_order_not_found", { requestId, orderId: paymentRow.order_id });
    return badRequest("Invalid webhook payload.", "INTERNAL_ORDER_NOT_FOUND", request);
  }

  if (internalOrder.payment_status === "paid") {
    logInfo("webhook.already_paid", { requestId, orderId: internalOrder.id });
    await recordWebhookEvent(supabase, eventId, eventName, payload);
    return NextResponse.json({ success: true, message: "Payment already captured." });
  }

  if (internalOrder.razorpay_payment_id && internalOrder.razorpay_payment_id !== razorpayPaymentId) {
    securityLog("razorpay.webhook.payment_id_mismatch", {
      orderId: internalOrder.id,
      existing: internalOrder.razorpay_payment_id,
      incoming: razorpayPaymentId
    });
    logWarn("webhook.payment_id_mismatch", { requestId, orderId: internalOrder.id });
    return badRequest("Invalid webhook payload.", "PAYMENT_ID_MISMATCH", request);
  }

  const trustedPayment = await fetchRazorpayPayment(razorpayPaymentId);
  const verifiedPayment = trustedPayment ?? payment;

  if (!verifiedPayment) {
    logWarn("webhook.payment_fetch_failed", { requestId, razorpayPaymentId });
    return badRequest("Invalid webhook payload.", "PAYMENT_FETCH_FAILED", request);
  }

  const paidAmount = verifiedPayment.amount ?? 0;
  const currency = verifiedPayment.currency ?? "INR";
  const providerStatus = verifiedPayment.status ?? "";
  const expectedAmount = Math.round(Number(internalOrder.total) * 100);

  if (paidAmount !== expectedAmount || currency !== "INR") {
    securityLog("razorpay.webhook.amount_mismatch", {
      orderId: internalOrder.id,
      expected: expectedAmount,
      actual: paidAmount
    });
    logWarn("webhook.amount_mismatch", {
      requestId,
      orderId: internalOrder.id,
      expected: expectedAmount,
      actual: paidAmount
    });
    return badRequest("Invalid webhook payload.", "AMOUNT_MISMATCH", request);
  }

  if (!["captured", "paid"].includes(String(providerStatus).toLowerCase())) {
    securityLog("razorpay.webhook.not_captured", {
      orderId: internalOrder.id,
      status: providerStatus
    });
    logWarn("webhook.not_captured", { requestId, orderId: internalOrder.id, status: providerStatus });
    return badRequest("Invalid webhook payload.", "NOT_CAPTURED", request);
  }

  const paidAt = new Date().toISOString();

  const stockError = await decrementStockForPaidOrder(supabase, internalOrder.id);
  if (stockError) {
    securityLog("razorpay.webhook.stock_decrement_failed", {
      orderId: internalOrder.id,
      error: stockError
    });
    logError("webhook.stock_decrement_failed", {
      requestId,
      orderId: internalOrder.id,
      error: stockError
    });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_method: "online",
      payment_status: "paid",
      order_status: "confirmed",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      paid_at: paidAt,
      notes: {
        razorpayOrderId,
        razorpayPaymentId,
        razorpayMethod: verifiedPayment.method ?? payment?.method ?? "",
        razorpayStatus: providerStatus,
        webhookEvent: eventName,
        webhookEventId: eventId,
        razorpayPaidAt: paidAt,
        requestId
      }
    })
    .eq("id", internalOrder.id);

  if (updateError) {
    securityLog("razorpay.webhook.order_update_failed", {
      event: eventName,
      orderId: internalOrder.id,
      error: updateError.message
    });
    logError("webhook.order_update_failed", {
      requestId,
      orderId: internalOrder.id,
      error: updateError.message
    });
    return serverError("Webhook verified, but order update failed.", "ORDER_UPDATE_FAILED", request);
  }

  await supabase
    .from("payments")
    .update({
      provider_payment_id: razorpayPaymentId,
      method: verifiedPayment.method ?? payment?.method ?? "online",
      status: "paid",
      raw_response: payload,
      paid_at: paidAt
    })
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId);

  await recordWebhookEvent(supabase, eventId, eventName, payload);
  await publishEvent({
    type: "payment.captured",
    severity: "info",
    entityId: internalOrder.id,
    entityType: "order",
    payload: { eventName, eventId, orderNumber: internalOrder.order_number, providerOrderId: razorpayOrderId }
  }).catch(() => undefined);

  securityLog("razorpay.webhook.payment_confirmed", {
    event: eventName,
    orderId: internalOrder.id,
    orderNumber: internalOrder.order_number
  });

  logInfo("webhook.payment_confirmed", {
    requestId,
    orderId: internalOrder.id,
    orderNumber: internalOrder.order_number
  });

  try {
    const notificationId = await enqueueOrderConfirmationNotification(supabase, internalOrder.id);
    if (!notificationId) {
      throw new Error("Paid order did not produce a WhatsApp notification.");
    }
    const result = await dispatchOrderNotification(supabase, notificationId);
    if (result.sent) {
      logInfo("webhook.whatsapp.sync_sent", { requestId, orderId: internalOrder.id });
    } else {
      logWarn("webhook.whatsapp.retry_scheduled", {
        requestId,
        orderId: internalOrder.id,
        notificationId,
        error: result.error
      });
    }
  } catch (syncError) {
    logWarn("webhook.whatsapp.outbox_error", {
      requestId,
      orderId: internalOrder.id,
      error: syncError instanceof Error ? syncError.message : String(syncError)
    });
  }

  return NextResponse.json({
    success: true,
    message: "Payment captured and order confirmed.",
    requestId,
    data: { id: internalOrder.id, order_number: internalOrder.order_number }
  });
});

async function markWebhookPaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  payload: RazorpayWebhookPayload,
  eventId: string,
  eventName: string,
  requestId: string
) {
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? order?.id;

  if (!razorpayOrderId) {
    return badRequest("Invalid webhook payload.", "MISSING_ORDER_ID");
  }

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("order_id")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .maybeSingle();

  if (!paymentRow?.order_id) {
    logInfo("webhook.failed_event_no_order", { requestId, razorpayOrderId });
    return NextResponse.json({ success: true, message: "Failed payment webhook ignored." });
  }

  const errorDescription = payment?.error_description ?? payment?.error_code ?? "Payment failed";
  logWarn("webhook.payment_failed", { requestId, orderId: paymentRow.order_id, error: errorDescription });

  await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      order_status: "pending",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: payment?.id ?? null,
      last_error: errorDescription,
      notes: {
        razorpayOrderId,
        razorpayPaymentId: payment?.id ?? "",
        razorpayStatus: "failed",
        razorpayError: errorDescription,
        webhookEvent: eventName,
        webhookEventId: eventId,
        requestId
      }
    })
    .eq("id", paymentRow.order_id);

  await supabase
    .from("payments")
    .update({
      provider_payment_id: payment?.id ?? null,
      method: payment?.method ?? "online",
      status: "failed",
      error_message: errorDescription,
      raw_response: payload
    })
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId);

  await recordWebhookEvent(supabase, eventId, eventName, payload);
  await publishEvent({
    type: "admin.alert",
    severity: "warn",
    entityId: paymentRow.order_id,
    entityType: "order",
    payload: { eventName, eventId, providerOrderId: razorpayOrderId, status: "failed", error: errorDescription }
  }).catch(() => undefined);

  securityLog("razorpay.webhook.payment_failed", { orderId: paymentRow.order_id, error: errorDescription });
  return NextResponse.json({ success: true, message: "Failed payment recorded." });
}

async function hasWebhookEvent(supabase: ReturnType<typeof createAdminClient>, eventId: string) {
  const { data, error } = await supabase
    .from("razorpay_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    logWarn("webhook.has_event_query_failed", { error: error.message });
  }

  return !error && Boolean(data?.event_id);
}

async function recordWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  eventName: string,
  payload: RazorpayWebhookPayload
) {
  const razorpayOrderId = payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id ?? null;
  const razorpayPaymentId = payload.payload?.payment?.entity?.id ?? null;
  const { error } = await supabase.from("razorpay_webhook_events").insert({
    event_id: eventId,
    event_name: eventName,
    provider_order_id: razorpayOrderId,
    provider_payment_id: razorpayPaymentId,
    payload
  });

  if (error && error.code !== "23505") {
    logWarn("webhook.event_log_failed", { event: eventName, error: error.message });
  }
}

async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentEntity | null> {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = getRequiredRazorpayServerEnv();
    const response = await fetchWithTimeout(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      timeoutMs: 2500
    });
    if (!response.ok) {
      logWarn("webhook.razorpay_api_fetch_failed", { paymentId, status: response.status });
      return null;
    }
    return ((await safeJson<RazorpayPaymentEntity>(response)) ?? null) as RazorpayPaymentEntity | null;
  } catch (error) {
    logWarn("webhook.razorpay_api_fetch_error", {
      paymentId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function decrementStockForPaidOrder(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<string | null> {
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, title, quantity")
    .eq("order_id", orderId);

  if (itemsError || !items || items.length === 0) {
    return itemsError?.message ?? "No order items found.";
  }

  for (const item of items) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("stock, title")
      .eq("id", item.product_id)
      .single();

    if (productError || !product) {
      return `Product not found for ${item.title}.`;
    }

    const nextStock = Number(product.stock ?? 0) - Number(item.quantity ?? 0);
    if (nextStock < 0) {
      return `Insufficient stock for ${String(product.title ?? item.title)}.`;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", item.product_id);

    if (updateError) {
      return `Failed to update stock for ${String(product.title ?? item.title)}.`;
    }
  }
  return null;
}

function safeEqual(expected: string, provided: string) {
  try {
    const left = Buffer.from(expected);
    const right = Buffer.from(provided);
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
