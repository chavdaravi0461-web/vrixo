import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getRequiredRazorpayServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { badRequest, serverError, tooManyRequests } from "@/lib/api-response";
import { securityLog } from "@/lib/security";
import { publishEvent } from "@/lib/event-bus";

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
};

export async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "razorpay-webhook",
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return serverError("Webhook is temporarily unavailable.");
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  if (!safeEqual(expectedSignature, signature)) {
    securityLog("razorpay.webhook.signature_failed");
    return badRequest("Invalid webhook signature.");
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return badRequest("Invalid webhook payload.");
  }

  const eventName = payload.event ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") || `${eventName}:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  const supabase = createAdminClient();
  await publishEvent({
    type: "webhook.received",
    severity: "info",
    entityType: "razorpay",
    payload: { eventName, eventId }
  });

  const duplicate = await hasWebhookEvent(supabase, eventId);
  if (duplicate) {
    return NextResponse.json({ success: true, message: "Webhook already processed." });
  }

  if (["payment.failed", "order.payment_failed"].includes(eventName)) {
    return markWebhookPaymentFailed(supabase, payload, eventId, eventName);
  }

  if (!["payment.captured", "order.paid"].includes(eventName)) {
    await recordWebhookEvent(supabase, eventId, eventName, payload);
    return NextResponse.json({ success: true, message: "Webhook event ignored." });
  }

  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? order?.id;
  const razorpayPaymentId = payment?.id;

  if (!razorpayOrderId) {
    return badRequest("Invalid webhook payload.");
  }

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("order_id, amount, currency, status, orders!inner(id, order_number, total, payment_method, payment_status)")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .maybeSingle();

  const internalOrder = Array.isArray(paymentRow?.orders) ? paymentRow?.orders[0] : paymentRow?.orders;

  if (!paymentRow?.order_id || !internalOrder) {
    return badRequest("Invalid webhook payload.");
  }

  const trustedPayment = razorpayPaymentId
    ? await fetchRazorpayPayment(razorpayPaymentId)
    : payment;

  if (!trustedPayment && !order) {
    return badRequest("Invalid webhook payload.");
  }

  const paidAmount =
    trustedPayment?.amount ??
    payment?.amount ??
    order?.amount_paid ??
    order?.amount ??
    0;
  const currency = trustedPayment?.currency ?? payment?.currency ?? order?.currency ?? "INR";
  const providerStatus = trustedPayment?.status ?? payment?.status ?? order?.status ?? "";
  const expectedAmount = Math.round(Number(internalOrder.total ?? paymentRow.amount ?? 0) * 100);

  if (paidAmount !== expectedAmount || currency !== "INR") {
    securityLog("razorpay.webhook.amount_mismatch", { orderId: paymentRow.order_id });
    return badRequest("Invalid webhook payload.");
  }

  if (!["captured", "paid"].includes(String(providerStatus).toLowerCase())) {
    securityLog("razorpay.webhook.not_captured", { orderId: paymentRow.order_id, status: providerStatus });
    return badRequest("Invalid webhook payload.");
  }

  const paidAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_method: "online",
      payment_status: "paid",
      order_status: "confirmed",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId ?? null,
      paid_at: paidAt,
      notes: {
        razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId ?? "",
        razorpayMethod: trustedPayment?.method ?? payment?.method ?? "",
        razorpayStatus: providerStatus,
        webhookEvent: eventName,
        webhookEventId: eventId,
        razorpayPaidAt: paidAt
      }
    })
    .eq("id", paymentRow.order_id)
    .select("id, order_number")
    .maybeSingle();

  if (error || !data) {
    securityLog("razorpay.webhook.order_update_failed", { event: eventName, orderId: paymentRow.order_id });
    return serverError("Webhook verified, but order update failed.");
  }

  await supabase
    .from("payments")
    .update({
      provider_payment_id: razorpayPaymentId ?? null,
      method: trustedPayment?.method ?? payment?.method ?? "online",
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
    entityId: data.id,
    entityType: "order",
    payload: { eventName, eventId, orderNumber: data.order_number, providerOrderId: razorpayOrderId }
  });

  securityLog("razorpay.webhook.payment_confirmed", {
    event: eventName,
    orderId: data.id,
    orderNumber: data.order_number
  });

  void import("@/services/notifications/order-whatsapp")
    .then(({ dispatchOrderWhatsAppByOrderId }) => dispatchOrderWhatsAppByOrderId(paymentRow.order_id))
    .catch((whatsappError) => {
      console.warn("[razorpay.webhook] whatsapp dispatch failed", whatsappError);
    });

  return NextResponse.json({
    success: true,
    message: "Payment captured and order confirmed.",
    data
  });
}

async function markWebhookPaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  payload: RazorpayWebhookPayload,
  eventId: string,
  eventName: string
) {
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const razorpayOrderId = payment?.order_id ?? order?.id;

  if (!razorpayOrderId) {
    return badRequest("Invalid webhook payload.");
  }

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("order_id")
    .eq("provider", "razorpay")
    .eq("provider_order_id", razorpayOrderId)
    .maybeSingle();

  if (!paymentRow?.order_id) {
    return NextResponse.json({ success: true, message: "Failed payment webhook ignored." });
  }

  await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      order_status: "pending",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: payment?.id ?? null
    })
    .eq("id", paymentRow.order_id);

  await supabase
    .from("payments")
    .update({
      provider_payment_id: payment?.id ?? null,
      method: payment?.method ?? "online",
      status: "failed",
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
    payload: { eventName, eventId, providerOrderId: razorpayOrderId, status: "failed" }
  });

  securityLog("razorpay.webhook.payment_failed", { orderId: paymentRow.order_id });
  return NextResponse.json({ success: true, message: "Failed payment recorded." });
}

async function hasWebhookEvent(supabase: ReturnType<typeof createAdminClient>, eventId: string) {
  const { data, error } = await supabase
    .from("razorpay_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

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
    securityLog("razorpay.webhook.event_log_failed", { event: eventName });
  }
}

async function fetchRazorpayPayment(paymentId: string) {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = getRequiredRazorpayServerEnv();
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`
      }
    });
    if (!response.ok) return null;
    return (await response.json()) as RazorpayPaymentEntity;
  } catch {
    return null;
  }
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
