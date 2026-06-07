import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import { createTicket } from "@/lib/support/tickets";
import { cancelCustomerOrder, getCustomerFromWhatsApp, getOrderByNumber } from "@/lib/whatsapp/customer-context";
import { sendWhatsAppTicketCreated, sendWhatsAppReturnRequested, sendAdminAlertWhatsApp, sendOrderStatusWhatsApp } from "@/lib/whatsapp/order-events";
import { buildCancellationConfirmation, buildCancellationFailed, buildOrderNotFound, buildCancellableOrdersMessage } from "@/lib/whatsapp/order-display";
import { isOrderCancellable } from "@/lib/orders/order-state-machine";

export type ButtonAction = "need_help" | "cancel_order" | "return_order" | "track_order" | "my_orders" | "contact_support";

export type ButtonHandlerResult = {
  action: ButtonAction;
  success: boolean;
  message: string;
  error?: string;
};

export async function handleNeedHelp(
  phone: string,
  name: string | null,
  orderNumber?: string | null
): Promise<ButtonHandlerResult> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) {
    return { action: "need_help", success: false, message: "Could not identify your account." };
  }

  const ctx = await getCustomerFromWhatsApp(phone);
  const customerName = name || ctx?.name || "Valued Customer";

  const result = await createTicket({
    customerName: customerName,
    customerPhone: digits,
    subject: orderNumber ? `Help needed with order #${orderNumber}` : "Help request",
    description: `Customer requested assistance via WhatsApp.${orderNumber ? ` Order: #${orderNumber}` : ""}`,
    category: "general",
    source: "whatsapp",
    orderNumber: orderNumber ?? undefined,
  });

  if (!result.success) {
    return { action: "need_help", success: false, message: "Could not create support ticket. Please try again." };
  }

  await sendWhatsAppTicketCreated(phone, result.ticketNumber ?? "", "Help Request").catch(() => {});

  await sendAdminAlertWhatsApp(
    `🆘 Support ticket created\nTicket: #${result.ticketNumber}\nCustomer: ${customerName}\nPhone: ${digits}${orderNumber ? `\nOrder: #${orderNumber}` : ""}`
  ).catch(() => {});

  return {
    action: "need_help",
    success: true,
    message: `I've created a support ticket (${result.ticketNumber}) for you. Our team will get back to you shortly.`,
  };
}

export async function handleCancelOrder(
  phone: string,
  orderNumber: string
): Promise<ButtonHandlerResult> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) {
    return { action: "cancel_order", success: false, message: "Could not identify your account." };
  }

  const order = await getOrderByNumber(orderNumber, phone);
  if (!order) {
    return { action: "cancel_order", success: false, message: buildOrderNotFound(orderNumber) };
  }

  if (!order.isCancellable) {
    return {
      action: "cancel_order",
      success: false,
      message: buildCancellationFailed(orderNumber, `Order #${orderNumber} is ${order.orderStatus} and cannot be cancelled. Cancellation is only available for pending or confirmed orders.`),
    };
  }

  const result = await cancelCustomerOrder(orderNumber, phone, "Customer requested via WhatsApp button");
  if (!result.success) {
    return {
      action: "cancel_order",
      success: false,
      message: buildCancellationFailed(orderNumber, result.error ?? "Could not cancel order. Please try again."),
    };
  }

  if (result.order) {
    await sendOrderStatusWhatsApp({
      customerName: result.order.customerName,
      customerPhone: digits,
      orderNumber: result.order.orderNumber,
      orderStatus: "cancelled",
      paymentMethod: result.order.paymentMethod as "cod" | "online",
      paymentStatus: result.order.paymentStatus,
      totalAmount: result.order.total,
      items: result.order.items as Array<Record<string, unknown>>,
    }).catch(() => {});
  }

  return {
    action: "cancel_order",
    success: true,
    message: buildCancellationConfirmation(result.order ?? order),
  };
}

export async function handleReturnOrder(
  phone: string,
  orderNumber: string,
  reason?: string
): Promise<ButtonHandlerResult> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) {
    return { action: "return_order", success: false, message: "Could not identify your account." };
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, order_status, customer_name, customer_phone, items, total")
    .eq("order_number", orderNumber)
    .eq("customer_phone", digits)
    .maybeSingle();

  if (!order) {
    return { action: "return_order", success: false, message: buildOrderNotFound(orderNumber) };
  }

  if (!isOrderCancellable(String(order.order_status ?? ""))) {
    const status = String(order.order_status ?? "");
    if (status !== "delivered") {
      return { action: "return_order", success: false, message: `Order #${orderNumber} is ${status}. Returns are only available for delivered orders within 7 days of delivery.` };
    }
  }

  const { createReturnRequest } = await import("@/lib/orders/return-flow");
  const result = await createReturnRequest({
    orderId: String(order.id),
    customerName: String(order.customer_name ?? ""),
    customerPhone: digits,
    reason: reason || "Customer requested return via WhatsApp",
  });

  if (!result.success) {
    return { action: "return_order", success: false, message: `Could not create return request: ${result.error}` };
  }

  await sendWhatsAppReturnRequested(phone, orderNumber).catch(() => {});

  await sendAdminAlertWhatsApp(
    `🔄 Return requested\nOrder: #${orderNumber}\nCustomer: ${order.customer_name}\nPhone: ${digits}`
  ).catch(() => {});

  return {
    action: "return_order",
    success: true,
    message: `Your return request for order #${orderNumber} has been submitted. We'll review it and get back to you within 24 hours.`,
  };
}
