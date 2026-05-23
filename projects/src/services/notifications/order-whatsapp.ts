import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import { connectMongo, WhatsAppAttempt } from "@/lib/mongo/models";
import {
  sendOrderConfirmationWhatsApp,
  type WhatsAppCustomerPayload,
  type WhatsAppSendResult
} from "@/lib/whatsapp";
import { whatsappLog } from "@/lib/whatsapp/logger";
import { toWhatsAppErrorMessage } from "@/lib/whatsapp/errors";
import { formatWhatsAppPhone } from "@/lib/whatsapp/phone";
import { getAppUrl } from "@/lib/app-url";

export type DispatchOrderWhatsAppInput = WhatsAppCustomerPayload & {
  orderId: string;
  userId?: string;
};

export type DispatchOrderWhatsAppResult = WhatsAppSendResult & {
  skipped?: boolean;
  reason?: string;
};

/**
 * Idempotent order confirmation WhatsApp dispatcher.
 * - COD: sends immediately after order is saved
 * - Online: sends only when paymentStatus === "paid"
 * - Skips duplicate sends when whatsapp_status is already "sent"
 */
export async function dispatchOrderConfirmationWhatsApp(
  input: DispatchOrderWhatsAppInput,
  options?: { force?: boolean }
): Promise<DispatchOrderWhatsAppResult> {
  const supabase = createAdminClient();

  if (input.paymentMethod === "online" && input.paymentStatus.toLowerCase() !== "paid") {
    whatsappLog("info", "order_confirmation.skipped_unpaid_online", {
      orderId: input.orderId,
      paymentStatus: input.paymentStatus
    });
    return {
      sent: false,
      provider: "whatsapp",
      error: null,
      adminNotified: false,
      skipped: true,
      reason: "online_payment_not_confirmed"
    };
  }

  if (!formatWhatsAppPhone(input.customerPhone)) {
    whatsappLog("warn", "order_confirmation.invalid_phone", { orderId: input.orderId });
    await supabase
      .from("orders")
      .update({
        whatsapp_status: "failed",
        whatsapp_error: "Invalid customer phone number."
      })
      .eq("id", input.orderId);

    return {
      sent: false,
      provider: "whatsapp",
      error: "Invalid customer phone number.",
      adminNotified: false,
      skipped: true,
      reason: "invalid_phone"
    };
  }

  if (!options?.force) {
    const { data: existing } = await supabase
      .from("orders")
      .select("whatsapp_status")
      .eq("id", input.orderId)
      .maybeSingle();

    if (existing?.whatsapp_status === "sent") {
      whatsappLog("info", "order_confirmation.duplicate_skipped", { orderId: input.orderId });
      return {
        sent: true,
        provider: "whatsapp",
        error: null,
        adminNotified: false,
        skipped: true,
        reason: "already_sent"
      };
    }

    const { data: claimed } = await supabase
      .from("orders")
      .update({ whatsapp_status: "sending", whatsapp_error: null })
      .eq("id", input.orderId)
      .neq("whatsapp_status", "sent")
      .select("id")
      .maybeSingle();

    if (!claimed?.id) {
      whatsappLog("info", "order_confirmation.claim_skipped", { orderId: input.orderId });
      return {
        sent: false,
        provider: "whatsapp",
        error: null,
        adminNotified: false,
        skipped: true,
        reason: "already_sending_or_sent"
      };
    }
  }

  whatsappLog("info", "order_confirmation.dispatch_started", {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentMethod: input.paymentMethod
  });

  let result: WhatsAppSendResult;

  try {
    result = await sendOrderConfirmationWhatsApp(input);
  } catch (error) {
    const message = toWhatsAppErrorMessage(error);
    whatsappLog("error", "order_confirmation.dispatch_failed", {
      orderId: input.orderId,
      error: message
    });
    result = {
      sent: false,
      provider: "whatsapp",
      error: message,
      adminNotified: false
    };
  }

  try {
    await supabase
      .from("orders")
      .update({
        whatsapp_status: result.sent ? "sent" : "failed",
        whatsapp_error: result.error
      })
      .eq("id", input.orderId);
  } catch (updateError) {
    whatsappLog("warn", "order_confirmation.status_update_failed", {
      orderId: input.orderId,
      error: updateError instanceof Error ? updateError.message : "unknown"
    });
  }

  try {
    await connectMongo();
    await WhatsAppAttempt.create({
      orderId: input.orderId,
      attempt: 1,
      status: result.sent ? "sent" : "failed",
      error: result.error ?? undefined,
      response: {
        orderNumber: input.orderNumber,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        adminNotified: result.adminNotified
      }
    });
  } catch (mongoError) {
    whatsappLog("warn", "order_confirmation.mongo_log_failed", {
      orderId: input.orderId,
      error: mongoError instanceof Error ? mongoError.message : "unknown"
    });
  }

  await publishEvent({
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
      paymentMethod: input.paymentMethod,
      skipped: false
    }
  }).catch(() => undefined);

  whatsappLog(result.sent ? "info" : "warn", "order_confirmation.dispatch_finished", {
    orderId: input.orderId,
    sent: result.sent,
    adminNotified: result.adminNotified
  });

  return result;
}

/** Loads order from Supabase and dispatches WhatsApp (used by Razorpay webhook fallback). */
export async function dispatchOrderWhatsAppByOrderId(orderId: string) {
  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, order_number, order_status, payment_method, payment_status, customer_name, customer_phone, total, items, shipping_address, whatsapp_status"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    whatsappLog("warn", "order_confirmation.order_not_found", { orderId });
    return { sent: false, provider: "whatsapp" as const, error: "Order not found.", adminNotified: false };
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
      items
        .map((item) => (item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? "") : ""))
        .filter(Boolean)
        .join(", ") || "Vrixo product",
    totalQty: items.reduce(
      (sum, item) =>
        sum + (item && typeof item === "object" ? Number((item as Record<string, unknown>).quantity ?? 1) : 1),
      0
    ),
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
