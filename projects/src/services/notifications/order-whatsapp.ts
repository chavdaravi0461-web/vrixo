import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import {
  sendOrderConfirmationWhatsApp,
  type WhatsAppCustomerPayload,
  type WhatsAppSendResult
} from "@/lib/whatsapp";

import { toWhatsAppErrorMessage } from "@/lib/whatsapp/errors";
import { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
import { getAppUrl } from "@/lib/app-url";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { saveWhatsAppLog } from "@/services/notifications/whatsapp-log-store";

export type DispatchOrderWhatsAppInput = WhatsAppCustomerPayload & {
  orderId: string;
  userId?: string;
};

export type DispatchOrderWhatsAppResult = WhatsAppSendResult & {
  skipped?: boolean;
  reason?: string;
};

const WHATSAPP_STATUS_SENDING = "sending";
const WHATSAPP_STATUS_SENT = "sent";
const WHATSAPP_STATUS_FAILED = "failed";

async function claimWhatsAppSlot(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<boolean> {
  const { data: claimed } = await supabase
    .from("orders")
    .update({ whatsapp_status: WHATSAPP_STATUS_SENDING, whatsapp_error: null })
    .eq("id", orderId)
    .neq("whatsapp_status", WHATSAPP_STATUS_SENT)
    .neq("whatsapp_status", WHATSAPP_STATUS_SENDING)
    .select("id")
    .maybeSingle();

  return Boolean(claimed?.id);
}

export async function dispatchOrderConfirmationWhatsApp(
  input: DispatchOrderWhatsAppInput,
  options?: { force?: boolean; jobId?: string; attempt?: number }
): Promise<DispatchOrderWhatsAppResult> {
  const supabase = createAdminClient();
  const startTime = performance.now();

  logInfo("whatsapp.dispatch.started", {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    force: options?.force,
    jobId: options?.jobId,
    attempt: options?.attempt
  });

  if (input.paymentMethod === "online" && input.paymentStatus.toLowerCase() !== "paid") {
    logInfo("whatsapp.dispatch.skip_unpaid_online", {
      orderId: input.orderId,
      paymentStatus: input.paymentStatus
    });
    const skipped = { sent: false, provider: "whatsapp" as const, error: null, adminNotified: false, skipped: true, reason: "online_payment_not_confirmed" };
    await saveWhatsAppLog({
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      jobId: options?.jobId,
      channel: "order_confirmation",
      attempt: options?.attempt ?? 1,
      status: "skipped",
      response: { reason: skipped.reason, paymentStatus: input.paymentStatus }
    });
    return skipped;
  }

  const formattedPhone = formatWhatsAppPhone(input.customerPhone);
  if (!formattedPhone) {
    logWarn("whatsapp.dispatch.invalid_phone", { orderId: input.orderId, phone: `***${input.customerPhone.slice(-4)}` });
    await supabase.from("orders").update({ whatsapp_status: WHATSAPP_STATUS_FAILED, whatsapp_error: "Invalid customer phone number." }).eq("id", input.orderId);
    await saveWhatsAppLog({
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      jobId: options?.jobId,
      channel: "order_confirmation",
      attempt: options?.attempt ?? 1,
      status: "skipped",
      error: "Invalid customer phone number.",
      response: { reason: "invalid_phone" }
    });
    return { sent: false, provider: "whatsapp", error: "Invalid customer phone number.", adminNotified: false, skipped: true, reason: "invalid_phone" };
  }

  if (!options?.force) {
    const { data: existing } = await supabase
      .from("orders")
      .select("whatsapp_status")
      .eq("id", input.orderId)
      .maybeSingle();

    if (existing?.whatsapp_status === WHATSAPP_STATUS_SENT) {
      logInfo("whatsapp.dispatch.duplicate_skipped", { orderId: input.orderId });
      await saveWhatsAppLog({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        jobId: options?.jobId,
        channel: "order_confirmation",
        attempt: options?.attempt ?? 1,
        status: "skipped",
        response: { reason: "already_sent" }
      });
      return { sent: true, provider: "whatsapp", error: null, adminNotified: false, skipped: true, reason: "already_sent" };
    }

    const claimed = await claimWhatsAppSlot(supabase, input.orderId);
    if (!claimed) {
      logInfo("whatsapp.dispatch.claim_skipped", { orderId: input.orderId });
      await saveWhatsAppLog({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        jobId: options?.jobId,
        channel: "order_confirmation",
        attempt: options?.attempt ?? 1,
        status: "skipped",
        response: { reason: "already_sending_or_sent" }
      });
      return { sent: false, provider: "whatsapp", error: null, adminNotified: false, skipped: true, reason: "already_sending_or_sent" };
    }
  }

  logInfo("whatsapp.dispatch.sending", { orderId: input.orderId, orderNumber: input.orderNumber });

  let result: WhatsAppSendResult;

  try {
    result = await sendOrderConfirmationWhatsApp(input);
  } catch (error) {
    const message = toWhatsAppErrorMessage(error);
    logError("whatsapp.dispatch.failed", { orderId: input.orderId, error: message });
    result = { sent: false, provider: "whatsapp", error: message, adminNotified: false };
  }

  try {
    await supabase
      .from("orders")
      .update({
        whatsapp_status: result.sent ? WHATSAPP_STATUS_SENT : WHATSAPP_STATUS_FAILED,
        whatsapp_error: result.error
      })
      .eq("id", input.orderId);
  } catch (updateError) {
    logWarn("whatsapp.dispatch.status_update_failed", {
      orderId: input.orderId,
      error: updateError instanceof Error ? updateError.message : "unknown"
    });
  }

  await saveWhatsAppLog({
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    jobId: options?.jobId,
    channel: "order_confirmation",
    attempt: options?.attempt ?? 1,
    status: result.sent ? "sent" : "failed",
    messageId: result.customerMessageId,
    adminMessageId: result.adminMessageId,
    error: result.error ?? undefined,
    response: {
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      adminNotified: result.adminNotified,
      customerMessageId: result.customerMessageId,
      adminMessageId: result.adminMessageId,
      customerResponse: result.customerResponse,
      adminResponse: result.adminResponse,
      durationMs: Math.round(performance.now() - startTime)
    }
  });

  publishEvent({
    type: "whatsapp.event",
    severity: result.sent ? "info" : "warn",
    entityId: input.orderId,
    entityType: "order",
    customerId: input.userId,
    payload: {
      orderNumber: input.orderNumber,
      sent: result.sent,
      error: result.error,
      adminNotified: result.adminNotified,
      customerMessageId: result.customerMessageId,
      adminMessageId: result.adminMessageId,
      paymentMethod: input.paymentMethod,
      durationMs: Math.round(performance.now() - startTime)
    }
  }).catch(() => undefined);

  logInfo("whatsapp.dispatch.completed", {
    orderId: input.orderId,
    sent: result.sent,
    adminNotified: result.adminNotified,
    durationMs: Math.round(performance.now() - startTime)
  });

  return result;
}

export async function dispatchOrderWhatsAppByOrderId(orderId: string) {
  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, order_number, order_status, payment_method, payment_status, customer_name, customer_phone, total, items, shipping_address, whatsapp_status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    logWarn("whatsapp.by_order_id.not_found", { orderId });
    return { sent: false, provider: "whatsapp" as const, error: "Order not found.", adminNotified: false };
  }

  if (order.whatsapp_status === WHATSAPP_STATUS_SENT) {
    logInfo("whatsapp.by_order_id.already_sent", { orderId });
    return { sent: true, provider: "whatsapp" as const, error: null, adminNotified: false };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : {};
  const paymentMethod = resolvePaymentMethod(order.payment_method);

  return dispatchOrderConfirmationWhatsApp({
    orderId: order.id,
    userId: order.user_id,
    customerName: String(order.customer_name ?? "Customer"),
    customerPhone: String(order.customer_phone ?? ""),
    orderNumber: String(order.order_number),
    productNames:
      items.map((item) => (item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? "") : ""))
        .filter(Boolean)
        .join(", ") || "Vrixo product",
    totalQty: items.reduce((sum, item) =>
      sum + (item && typeof item === "object" ? Number((item as Record<string, unknown>).quantity ?? 1) : 1), 0),
    totalAmount: Number(order.total ?? 0),
    orderStatus: String(order.order_status ?? "pending"),
    paymentMethod,
    paymentStatus: String(order.payment_status ?? ""),
    productImageUrl: resolveProductImageUrl(firstItem),
    deliveryAddress: formatAddress(order.shipping_address)
  });
}

function resolvePaymentMethod(value: unknown): "cod" | "online" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "cod" || normalized.includes("cash")) return "cod";
  return "online";
}

function resolveProductImageUrl(item: Record<string, unknown>) {
  const raw = String(item.image ?? item.productImageUrl ?? "");
  const appUrl = getAppUrl();
  if (!raw) return `${appUrl}/placeholder-product.svg`;
  try {
    return new URL(raw, appUrl).toString();
  } catch {
    return `${appUrl}/placeholder-product.svg`;
  }
}

function formatAddress(value: unknown) {
  if (!value || typeof value !== "object") return "Delivery address saved with your order";
  const address = value as Record<string, unknown>;
  return (
    [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
      .map((part) => (part ? String(part).trim() : ""))
      .filter(Boolean)
      .join(", ") || "Delivery address saved with your order"
  );
}
