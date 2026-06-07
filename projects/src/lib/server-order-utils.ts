import type { CartItem } from "@/types/index";
import { createOrderNotification, dispatchOrderNotification, NotificationPayload, type NotificationResult } from "@/lib/notification-queue";
import { enqueueWhatsAppJob } from "@/services/notifications/whatsapp-queue";
import { publishRealtime } from "@/lib/realtime";
import { validateCouponForCheckout } from "@/lib/game-coupons";
import { getFallbackProductImage, normalizeProductImages } from "@/lib/product-images";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function calculateCouponDiscount(
  supabase: SupabaseClient,
  couponCode: string | undefined,
  subtotal: number
) {
  if (!couponCode) {
    return 0;
  }

  const result = await validateCouponForCheckout({ supabase, code: couponCode, subtotal });
  return result.ok ? result.discount : 0;
}

export async function buildOrderSnapshotFromProducts(supabase: SupabaseClient, items: CartItem[]) {
  if (items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const { data: products, error } = await supabase
    .from("products")
    .select("id, slug, title, price, stock, sku, images")
    .in("id", productIds);

  if (error) {
    throw error;
  }

  const productRows = (products ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    price: number;
    stock: number;
    sku: string;
    images: string[];
  }>;
  const productMap = new Map(productRows.map((product) => [String(product.id), product]));

  let subtotal = 0;
  let totalQty = 0;
  const itemNames: string[] = [];

  const snapshotItems = items.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new Error(`Product not found for cart item ${item.productId}.`);
    }

    const productStock = Number(product.stock ?? 0);
    if (productStock < item.quantity) {
      throw new Error(`Insufficient stock for ${String(product.title ?? item.title)}.`);
    }

    const unitPrice = Number(product.price ?? 0);
    subtotal += unitPrice * item.quantity;
    totalQty += item.quantity;
    itemNames.push(String(product.title ?? item.title));

    const productImages = normalizeProductImages(product.images, { fallback: false });

    return {
      productId: String(product.id),
      slug: String(product.slug ?? item.slug),
      title: String(product.title ?? item.title),
      image: productImages[0] ?? item.image ?? getFallbackProductImage(),
      price: unitPrice,
      quantity: item.quantity,
      stock: productStock,
      sku: String(product.sku ?? ""),
      selectedSize: item.selectedSize ?? null,
      selectedColor: item.selectedColor ?? null
    };
  });

  return {
    subtotal,
    totalQty,
    itemNames,
    snapshotItems
  };
}

export async function sendOrderSmsAndPersistStatus(
  supabase: SupabaseClient,
  order: {
    order_id: string;
    order_number: string;
    order_status: string;
    total: number;
    customer_name: string;
    customer_phone: string;
    sms_item_names: string;
    sms_total_qty: number;
    items: unknown;
    shipping_address: unknown;
  }
) {
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : {};
  const imageUrl = String(firstItem.image ?? "");

  const shippingAddress = order.shipping_address && typeof order.shipping_address === "object"
    ? (order.shipping_address as Record<string, unknown>)
    : {};

  const deliveryAddress = [
    shippingAddress.fullName,
    shippingAddress.line1,
    shippingAddress.line2,
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.postalCode,
    shippingAddress.country
  ]
    .map((value) => (value ? String(value).trim() : ""))
    .filter(Boolean)
    .join(", ");

  const payload: NotificationPayload = {
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    orderNumber: order.order_number,
    productNames: order.sms_item_names,
    totalQty: order.sms_total_qty,
    totalAmount: Number(order.total),
    orderStatus: order.order_status,
    paymentMethod: "cod",
    paymentStatus: "cod_pending",
    productImageUrl: imageUrl,
    deliveryAddress: deliveryAddress || "Delivery address saved with your order"
  };

  let smsResult: NotificationResult = { sent: false, error: "Notification queue unavailable.", attempts: 0 };
  let whatsappResult: NotificationResult = { sent: false, error: "Notification queue unavailable.", attempts: 0, adminNotified: false };

  try {
    const smsNotificationId = await createOrderNotification(
      supabase,
      order.order_id,
      "sms",
      "order_confirmation",
      payload
    );
    smsResult = await dispatchOrderNotification(supabase, smsNotificationId);
  } catch (queueError) {
    smsResult = {
      sent: false,
      error: queueError instanceof Error ? queueError.message : "SMS notification queue failed.",
      attempts: 0
    };
  }

  try {
    // enqueue to Redis-backed worker for WhatsApp delivery (BullMQ)
    const paymentMethod =
      String(order.order_status ?? "").toLowerCase().includes("cod") ||
      String(order.order_status ?? "").toLowerCase() === "pending"
        ? "cod"
        : "online";

    await enqueueWhatsAppJob({
      orderId: order.order_id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      productNames: order.sms_item_names,
      totalQty: order.sms_total_qty,
      totalAmount: Number(order.total),
      orderStatus: order.order_status,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "cod_pending" : "paid",
      productImageUrl: imageUrl,
      deliveryAddress:
        typeof payload.deliveryAddress === "string"
          ? payload.deliveryAddress
          : "Delivery address saved with your order"
    });

    whatsappResult = {
      sent: false,
      error: "queued",
      attempts: 0,
      adminNotified: false
    };

    // publish realtime event for admin UI
    try {
      await publishRealtime("realtime:orders", {
        type: "order_created",
        orderId: order.order_id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        total: Number(order.total)
      });
    } catch (e) {
      console.warn("[server-order-utils] publishRealtime failed", e);
    }
  } catch (queueError) {
    whatsappResult = {
      sent: false,
      error: queueError instanceof Error ? queueError.message : "WhatsApp notification queue failed.",
      attempts: 0,
      adminNotified: false
    };
  }

  await supabase
    .from("orders")
    .update({
      sms_status: smsResult.sent ? "sent" : smsResult.attempts >= 5 ? "failed" : "pending",
      sms_error: smsResult.sent ? null : smsResult.error,
      whatsapp_status: whatsappResult.sent ? "sent" : whatsappResult.attempts >= 5 ? "failed" : "pending",
      whatsapp_error: whatsappResult.sent ? null : whatsappResult.error
    })
    .eq("id", order.order_id);

  return {
    smsResult,
    whatsappResult
  };
}

export function buildPaymentMetadataShippingAddress(
  shippingAddress: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
  return {
    ...shippingAddress,
    paymentMeta: metadata
  };
}
