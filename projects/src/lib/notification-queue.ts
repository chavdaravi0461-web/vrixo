import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendOrderConfirmationSms } from "@/lib/sms";
import { hasEmailEnv, sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmailHtml } from "@/lib/email-templates/order-confirmation";
import { logInfo, logWarn, logError } from "@/lib/observability";

export type NotificationProvider = "sms" | "whatsapp" | "email";
export type NotificationEventType = "order_confirmation" | "delivery_update" | "admin_alert";

const notificationPayloadSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerPhone: z.string().trim().min(8).max(32),
  customerEmail: z.string().trim().email().optional(),
  orderNumber: z.string().trim().min(1).max(80),
  productNames: z.string().trim().min(1).max(1024),
  totalQty: z.coerce.number().int().nonnegative(),
  totalAmount: z.coerce.number().nonnegative(),
  orderStatus: z.string().trim().min(1).max(64),
  paymentMethod: z.enum(["cod", "online"]),
  paymentStatus: z.string().trim().min(1).max(64),
  deliveryAddress: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  productImageUrl: z.string().trim().max(2048).optional()
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export type NotificationResult = {
  sent: boolean;
  error: string | null;
  attempts: number;
  adminNotified?: boolean;
  providerMessageId?: string;
  response?: unknown;
};

type ClaimedNotification = {
  id: string;
  order_id: string;
  provider: NotificationProvider;
  event_type: NotificationEventType;
  attempts: number;
  max_attempts: number;
  payload: unknown;
};

const MAX_NOTIFICATION_ATTEMPTS = 8;
const BASE_RETRY_SECONDS = 30;
const MAX_RETRY_SECONDS = 60 * 60;

export function calculateNextRetry(attempt: number, now = Date.now()) {
  const exponentialSeconds = Math.min(
    MAX_RETRY_SECONDS,
    BASE_RETRY_SECONDS * 2 ** Math.max(0, attempt - 1)
  );
  const jitterSeconds = Math.floor(Math.random() * Math.max(1, exponentialSeconds * 0.2));
  return new Date(now + (exponentialSeconds + jitterSeconds) * 1000).toISOString();
}

export async function enqueueOrderConfirmationNotification(
  supabase: SupabaseClient,
  orderId: string
) {
  const { data, error } = await supabase.rpc("enqueue_order_confirmation_whatsapp", {
    p_order_id: orderId
  });

  if (error) {
    throw new Error(`Failed to enqueue WhatsApp confirmation: ${error.message}`);
  }

  return data ? String(data) : null;
}

export async function createOrderNotification(
  supabase: SupabaseClient,
  orderId: string,
  provider: NotificationProvider,
  eventType: NotificationEventType,
  payload: NotificationPayload
) {
  const validatedPayload = notificationPayloadSchema.parse(payload);
  const dedupeKey = `${provider}:${eventType}:${orderId}`;
  const { data, error } = await supabase
    .from("order_notifications")
    .upsert({
      order_id: orderId,
      provider,
      event_type: eventType,
      dedupe_key: dedupeKey,
      payload: validatedPayload,
      max_attempts: MAX_NOTIFICATION_ATTEMPTS
    }, {
      onConflict: "dedupe_key"
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to create notification queue entry: ${error?.message ?? "unknown"}`);
  }

  return String(data.id);
}

export async function dispatchOrderNotification(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotificationResult> {
  const workerId = buildWorkerId();
  const { data, error } = await supabase.rpc("claim_order_notification", {
    p_notification_id: notificationId,
    p_worker_id: workerId,
    p_lease_seconds: 120
  });

  if (error) {
    throw new Error(`Failed to claim notification: ${error.message}`);
  }

  const notification = normalizeRpcRow(data);
  if (!notification) {
    return {
      sent: false,
      error: "Notification is not claimable.",
      attempts: 0
    };
  }

  return dispatchClaimedNotification(supabase, notification);
}

export async function processPendingNotifications(
  supabase: SupabaseClient,
  limit = 20
) {
  const workerId = buildWorkerId();
  const { data, error } = await supabase.rpc("claim_order_notifications", {
    p_limit: Math.min(Math.max(limit, 1), 100),
    p_worker_id: workerId,
    p_lease_seconds: 120
  });

  if (error) {
    throw new Error(`Failed to claim pending notifications: ${error.message}`);
  }

  const notifications = normalizeRpcRows(data);
  return Promise.all(
    notifications.map(async (notification) => ({
      notificationId: notification.id,
      result: await dispatchClaimedNotification(supabase, notification)
    }))
  );
}

async function dispatchClaimedNotification(
  supabase: SupabaseClient,
  notification: ClaimedNotification
): Promise<NotificationResult> {
  logInfo("notification.queue.dispatch_claimed", {
    notificationId: notification.id,
    orderId: notification.order_id,
    provider: notification.provider,
    eventType: notification.event_type,
    attempt: notification.attempts
  });

  const parsedPayload = notificationPayloadSchema.safeParse(notification.payload);
  if (!parsedPayload.success) {
    const error = parsedPayload.error.issues.map((issue) => issue.message).join(" ");
    logWarn("notification.queue.invalid_payload", {
      notificationId: notification.id,
      error
    });
    return completeNotification(supabase, notification, {
      sent: false,
      error: `Invalid notification payload: ${error}`,
      attempts: notification.attempts
    }, "invalid_payload");
  }

  const payload = parsedPayload.data;
  if (!payload.customerEmail && notification.provider === "email") {
    logWarn("notification.queue.no_email", {
      notificationId: notification.id,
      orderId: notification.order_id
    });
    return completeNotification(supabase, notification, {
      sent: false,
      error: "No customer email address.",
      attempts: notification.attempts
    }, "no_email");
  }

  let result: NotificationResult;
  try {
    if (notification.provider === "sms") {
      logInfo("notification.queue.sending_sms", {
        notificationId: notification.id,
        orderId: notification.order_id
      });
      const smsResult = await sendOrderConfirmationSms({
        customerName: payload.customerName,
        phone: payload.customerPhone,
        orderNumber: payload.orderNumber,
        productNames: payload.productNames,
        totalQty: payload.totalQty,
        totalAmount: payload.totalAmount,
        orderStatus: payload.orderStatus
      });
      result = {
        sent: smsResult.sent,
        error: smsResult.error,
        attempts: notification.attempts,
        response: smsResult
      };
    } else {
      logInfo("notification.queue.sending_email", {
        notificationId: notification.id,
        orderId: notification.order_id
      });
      const emailResult = await sendEmail({
        to: payload.customerEmail || "",
        subject: `Order Confirmed — ${payload.orderNumber}`,
        html: buildOrderConfirmationEmailHtml({
          customerName: payload.customerName,
          orderNumber: payload.orderNumber,
          items: [],
          total: payload.totalAmount,
          paymentMethod: payload.paymentMethod,
          shippingAddress: formatDeliveryAddress(payload.deliveryAddress)
        })
      });
      logInfo("notification.queue.email_result", {
        notificationId: notification.id,
        sent: emailResult.sent,
        error: emailResult.error
      });
      result = {
        sent: emailResult.sent,
        error: emailResult.error,
        attempts: notification.attempts,
        response: emailResult
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("notification.queue.dispatch_error", {
      notificationId: notification.id,
      error: errorMsg,
      provider: notification.provider
    });
    result = {
      sent: false,
      error: errorMsg,
      attempts: notification.attempts
    };
  }

  return completeNotification(supabase, notification, result);
}

async function completeNotification(
  supabase: SupabaseClient,
  notification: ClaimedNotification,
  result: NotificationResult,
  errorCode?: string
) {
  const nextRetryAt = result.sent ? null : calculateNextRetry(notification.attempts);
  const { error } = await supabase.rpc("complete_order_notification", {
    p_notification_id: notification.id,
    p_sent: result.sent,
    p_provider_message_id: result.providerMessageId ?? null,
    p_error: result.error,
    p_error_code: errorCode ?? null,
    p_response: result.response ?? null,
    p_next_retry_at: nextRetryAt
  });

  if (error) {
    throw new Error(`Failed to persist notification result: ${error.message}`);
  }

  await supabase.from("order_notification_attempts").insert({
    notification_id: notification.id,
    provider: notification.provider,
    event_type: notification.event_type,
    attempt: notification.attempts,
    status: result.sent
      ? "sent"
      : notification.attempts >= notification.max_attempts
        ? "failed"
        : "retry_scheduled",
    error: result.error,
    response: result.response ?? null
  });

  return result;
}

function normalizeRpcRows(value: unknown): ClaimedNotification[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRpcRow).filter((row): row is ClaimedNotification => Boolean(row));
}

function normalizeRpcRow(value: unknown): ClaimedNotification | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (!record.id || !record.order_id || !record.provider || !record.event_type) return null;
  return {
    id: String(record.id),
    order_id: String(record.order_id),
    provider: String(record.provider) as NotificationProvider,
    event_type: String(record.event_type) as NotificationEventType,
    attempts: Number(record.attempts ?? 0),
    max_attempts: Number(record.max_attempts ?? MAX_NOTIFICATION_ATTEMPTS),
    payload: record.payload
  };
}

function buildWorkerId() {
  return `${process.env.VERCEL_REGION || process.env.HOSTNAME || "worker"}:${crypto.randomUUID()}`;
}

function formatDeliveryAddress(value: NotificationPayload["deliveryAddress"]) {
  if (!value) return "Delivery address saved with your order";
  if (typeof value === "string") return value.trim() || "Delivery address saved with your order";
  return (
    [value.line1, value.line2, value.city, value.state, value.postalCode, value.country]
      .map((part) => (part ? String(part).trim() : ""))
      .filter(Boolean)
      .join(", ") || "Delivery address saved with your order"
  );
}
