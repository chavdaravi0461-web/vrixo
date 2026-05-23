import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderConfirmationSms } from "@/lib/sms";
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp";

export type NotificationProvider = "sms" | "whatsapp";
export type NotificationEventType = "order_confirmation" | "delivery_update" | "admin_alert";

export type NotificationPayload = {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  productNames: string;
  totalQty: number;
  totalAmount: number;
  orderStatus: string;
  deliveryAddress?: string;
  productImageUrl?: string;
};

export type NotificationResult = {
  sent: boolean;
  error: string | null;
  attempts: number;
  adminNotified?: boolean;
};

const MAX_NOTIFICATION_ATTEMPTS = 5;
const BASE_RETRY_MINUTES = 10;

export function calculateNextRetry(attempt: number) {
  const delayMinutes = BASE_RETRY_MINUTES * Math.pow(2, Math.max(0, attempt - 1));
  const jitterMinutes = Math.floor(Math.random() * 5);
  return new Date(Date.now() + (delayMinutes + jitterMinutes) * 60 * 1000).toISOString();
}

export async function createOrderNotification(
  supabase: SupabaseClient,
  orderId: string,
  provider: NotificationProvider,
  eventType: NotificationEventType,
  payload: NotificationPayload
) {
  const insert = await supabase.from("order_notifications").insert({
    order_id: orderId,
    provider,
    event_type: eventType,
    payload,
    max_attempts: MAX_NOTIFICATION_ATTEMPTS
  }).select("id").single();

  if (insert.error || !insert.data?.id) {
    throw new Error("Failed to create notification queue entry.");
  }

  return insert.data.id as string;
}

async function recordNotificationAttempt(
  supabase: SupabaseClient,
  notificationId: string,
  provider: NotificationProvider,
  eventType: NotificationEventType,
  attempt: number,
  status: "sent" | "failed" | "retry_scheduled",
  error: string | null,
  response: unknown
) {
  await supabase.from("order_notification_attempts").insert({
    notification_id: notificationId,
    provider,
    event_type: eventType,
    attempt,
    status,
    error,
    response: response ? response : null
  });
}

async function updateNotificationStatus(
  supabase: SupabaseClient,
  notificationId: string,
  updates: Record<string, unknown>
) {
  await supabase
    .from("order_notifications")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", notificationId);
}

export async function dispatchOrderNotification(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotificationResult> {
  const { data: notification, error } = await supabase
    .from("order_notifications")
    .select("id, order_id, provider, event_type, attempts, max_attempts, payload")
    .eq("id", notificationId)
    .single();

  if (error || !notification) {
    throw new Error("Notification queue entry not found.");
  }

  const payload = notification.payload as NotificationPayload;
  const attempt = Number(notification.attempts ?? 0) + 1;
  let result: NotificationResult = {
    sent: false,
    error: "Notification dispatch failed.",
    attempts: attempt,
    adminNotified: false
  };

  try {
    if (notification.provider === "sms") {
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
        attempts: attempt
      };
    } else {
      const whatsappResult = await sendOrderConfirmationWhatsApp({
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        orderNumber: payload.orderNumber,
        productNames: payload.productNames,
        totalQty: payload.totalQty,
        totalAmount: payload.totalAmount,
        orderStatus: payload.orderStatus,
        paymentMethod: inferPaymentMethod(payload.orderStatus),
        paymentStatus: inferPaymentStatus(payload.orderStatus),
        productImageUrl: payload.productImageUrl ?? "",
        deliveryAddress: payload.deliveryAddress ?? ""
      });

      result = {
        sent: whatsappResult.sent,
        error: whatsappResult.error,
        attempts: attempt,
        adminNotified: whatsappResult.adminNotified
      };
    }
  } catch (dispatchError) {
    result = {
      sent: false,
      error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      attempts: attempt
    };
  }

  const status = result.sent ? "sent" : attempt >= Number(notification.max_attempts ?? MAX_NOTIFICATION_ATTEMPTS) ? "failed" : "retry_scheduled";
  const nextRetryAt = result.sent ? null : status === "failed" ? null : calculateNextRetry(attempt);

  await recordNotificationAttempt(
    supabase,
    notificationId,
    notification.provider,
    notification.event_type as NotificationEventType,
    attempt,
    status,
    result.error,
    result
  );

  await updateNotificationStatus(supabase, notificationId, {
    attempts: attempt,
    status,
    last_error: result.error,
    next_retry_at: nextRetryAt,
    sent_at: result.sent ? new Date().toISOString() : null
  });

  return result;
}

export async function processPendingNotifications(
  supabase: SupabaseClient,
  limit = 20
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("order_notifications")
    .select("id")
    .in("status", ["pending", "retry_scheduled"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .limit(limit);

  if (error) {
    throw error;
  }

  const notificationIds = (data ?? []).map((item) => String(item.id));
  const results: Array<{ notificationId: string; result: NotificationResult }> = [];

  for (const id of notificationIds) {
    try {
      const result = await dispatchOrderNotification(supabase, id);
      results.push({ notificationId: id, result });
    } catch (dispatchError) {
      results.push({
        notificationId: id,
        result: {
          sent: false,
          error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
          attempts: 0
        }
      });
    }
  }

  return results;
}

function inferPaymentMethod(orderStatus: string): "cod" | "online" {
  const normalized = orderStatus.toLowerCase();
  if (normalized.includes("cod") || normalized === "pending") return "cod";
  return "online";
}

function inferPaymentStatus(orderStatus: string) {
  const normalized = orderStatus.toLowerCase();
  if (normalized.includes("confirm") || normalized === "paid") return "paid";
  if (normalized.includes("cod")) return "cod_pending";
  return "pending";
}
