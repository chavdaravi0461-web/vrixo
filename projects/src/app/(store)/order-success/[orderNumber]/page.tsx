import { buildMetadata } from "@/lib/metadata";
import { getCurrentUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { decodeOrderNumberParam, isValidOrderNumber } from "@/lib/orders/order-numbers";
import {
  canQueryOrders,
  findOrderForUserWithRetry,
  findOrderByOrderNumber
} from "@/lib/orders/order-repository";
import { buildOrderStatusView } from "@/lib/orders/order-status";
import { OrderSuccessView } from "@/components/orders/order-success-view";

export const metadata = {
  ...buildMetadata("Order Success"),
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  params,
  searchParams
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ verifiedPayment?: string }>;
}) {
  const { orderNumber: rawOrderNumber } = await params;
  const query = await searchParams;
  const orderNumber = decodeOrderNumberParam(rawOrderNumber);
  const user = await getCurrentUser();

  if (!isValidOrderNumber(orderNumber)) {
    return (
      <OrderSuccessView
        orderNumber={orderNumber}
        initialOrder={null}
        initialError="Invalid order reference. Please open the order from My Orders."
        productImageUrl={`${getAppUrl()}/placeholder-product.svg`}
        productName="Vrixo product"
        totalQuantity={0}
        deliveryAddress="Not available"
        trackingSteps={[]}
      />
    );
  }

  if (!canQueryOrders()) {
    return (
      <OrderSuccessView
        orderNumber={orderNumber}
        initialOrder={null}
        initialError="Order service is temporarily unavailable. Please retry in a few seconds."
        productImageUrl={`${getAppUrl()}/placeholder-product.svg`}
        productName="Vrixo product"
        totalQuantity={0}
        deliveryAddress="Not available"
        trackingSteps={[]}
      />
    );
  }

  const order = user
    ? await findOrderForUserWithRetry(orderNumber, user.id)
    : await findOrderByOrderNumber(orderNumber);
  const appUrl = getAppUrl();

  if (!order) {
    return (
      <OrderSuccessView
        orderNumber={orderNumber}
        initialOrder={null}
        initialError={null}
        productImageUrl={`${appUrl}/placeholder-product.svg`}
        productName="Vrixo product"
        totalQuantity={0}
        deliveryAddress="Not available"
        trackingSteps={[]}
      />
    );
  }

  const orderItems = normalizeOrderItems(order.items);
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const productName =
    orderItems.map((item) => item.title).filter(Boolean).join(", ") || "Vrixo product";
  const productImageUrl = buildAbsoluteImageUrl(orderItems[0]?.image, appUrl);
  const deliveryAddress = formatDeliveryAddress(order.shipping_address);
  const orderDate = new Date(String(order.created_at ?? new Date().toISOString()));
  const statusView = buildOrderStatusView({
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status
  });

  return (
    <OrderSuccessView
      orderNumber={order.order_number}
      initialOrder={{
        id: order.id,
        orderNumber: order.order_number,
        total: Number(order.total ?? 0),
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        razorpayPaymentId: order.razorpay_payment_id,
        createdAt: order.created_at,
        customerPhone: order.customer_phone,
        customerName: order.customer_name,
        shippingAddress: order.shipping_address,
        items: order.items,
        whatsappStatus: order.whatsapp_status,
        whatsappError: order.whatsapp_error,
        statusView
      }}
      initialError={null}
      productImageUrl={productImageUrl}
      productName={productName}
      totalQuantity={totalQuantity}
      deliveryAddress={deliveryAddress}
      trackingSteps={buildTrackingSteps(orderDate, String(order.order_status ?? "pending").toLowerCase())}
    />
  );
}

function normalizeOrderItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      title: String(record.title ?? "Vrixo product"),
      quantity: Number(record.quantity ?? 1),
      image: record.image ? String(record.image) : ""
    };
  });
}

function buildAbsoluteImageUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return `${baseUrl}/placeholder-product.svg`;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return `${baseUrl}/placeholder-product.svg`;
  }
}

function formatDeliveryAddress(value: unknown) {
  const address = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parts = [
    address.fullName,
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ]
    .map((part) => (part ? String(part).trim() : ""))
    .filter(Boolean);

  return parts.join(", ") || "Delivery address saved with this order";
}

function buildTrackingSteps(orderDate: Date, status: string) {
  const shippedDate = addDays(orderDate, 1);
  const outForDeliveryDate = addDays(orderDate, 4);
  const deliveredDate = addDays(orderDate, 4);
  const statusRank = getStatusRank(status);

  return [
    {
      title: "Order Confirmed",
      date: formatShortDate(orderDate),
      description: "Your order has been placed.",
      time: `${formatShortDate(orderDate)} - ${formatTime(orderDate)}`,
      active: statusRank >= 1
    },
    {
      title: "Shipped",
      date: formatShortDate(shippedDate),
      description: `Vrixo Logistics - ${buildTrackingId(orderDate)}`,
      time: `Your item will be shipped by ${formatShortDate(shippedDate)}.`,
      active: statusRank >= 3
    },
    {
      title: "Out For Delivery",
      date: formatShortDate(outForDeliveryDate),
      description: "Your item will be sent out for delivery.",
      time: `Expected by ${formatShortDate(outForDeliveryDate)}`,
      active: statusRank >= 4
    },
    {
      title: "Delivered",
      date: formatShortDate(deliveredDate),
      description: "Your item will be delivered to your shipping address.",
      time: `Expected by ${formatShortDate(deliveredDate)}`,
      active: statusRank >= 5
    }
  ];
}

function getStatusRank(status: string) {
  if (status === "delivered") return 5;
  if (status === "shipped") return 3;
  if (status === "packed" || status === "processing") return 2;
  if (status === "cancelled") return 0;
  return 1;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "2-digit"
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(date)
    .toLowerCase();
}

function buildTrackingId(date: Date) {
  return `DC${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
