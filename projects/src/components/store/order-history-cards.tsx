"use client";

import { useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Home,
  MapPin,
  PackageCheck,
  ReceiptText,
  Truck
} from "lucide-react";
import { cleanProductTitle, cn, formatCurrency } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { Address, CartItem } from "@/types/index";

export type OrderHistoryItem = CartItem & {
  sku?: string | null;
};

export type OrderHistoryOrder = {
  id: string;
  orderNumber: string;
  items: OrderHistoryItem[];
  subtotal: number;
  discount: number;
  shippingCharge: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  shippingAddress?: Partial<Address> | null;
  couponCode?: string | null;
  createdAt: string;
  razorpayPaymentId?: string | null;
  smsStatus?: string | null;
};

export function OrderHistoryCards({
  orders,
  localNotice = false
}: {
  orders: OrderHistoryOrder[];
  localNotice?: boolean;
}) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(orders[0]?.id ?? null);

  if (orders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {localNotice ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950">
          These orders are saved on this device. Login to keep your order history in your account.
        </div>
      ) : null}

      {orders.map((order) => {
        const summary = getOrderSummary(order);
        const isOpen = openOrderId === order.id;
        const placedDate = new Date(order.createdAt);
        const visibleItems = isOpen ? order.items : order.items.slice(0, 2);

        return (
          <article
            key={order.id}
            className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_22px_70px_-48px_rgba(15,23,42,0.65)]"
          >
            <div className="grid gap-5 border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#eef6f4_100%)] p-5 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={summary.tone} label={summary.orderLabel} />
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {order.items.length} {order.items.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                  Order {order.orderNumber}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                  {formatCurrency(Number(order.total || 0))}
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  Placed on {formatLongDate(placedDate)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                <InfoTile icon={CreditCard} label="Payment" value={summary.paymentLabel} />
                <InfoTile icon={PackageCheck} label="Status" value={summary.paymentStatusLabel} />
                <InfoTile icon={Truck} label="Delivery" value={summary.deliveryLabel} />
              </div>
            </div>

            <div className="grid gap-6 p-5 xl:grid-cols-[1.35fr_0.8fr]">
              <div className="space-y-3">
                {visibleItems.map((item, index) => (
                  <div
                    key={`${order.id}-${item.productId}-${item.selectedSize ?? ""}-${item.selectedColor ?? ""}-${index}`}
                    className="grid grid-cols-[82px_1fr] gap-4 rounded-md border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white">
                      <Image
                        src={normalizeProductImage(item.image) ?? getFallbackProductImage()}
                        alt={cleanProductTitle(item.title)}
                        className="h-full w-full object-cover"
                        width={160}
                        height={160}
                        sizes="82px"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/product/${item.slug}`}
                        className="line-clamp-2 text-sm font-black text-slate-950 hover:text-teal-700"
                      >
                        {cleanProductTitle(item.title)}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                        <span>Qty {item.quantity}</span>
                        {item.selectedSize ? <span>Size {item.selectedSize}</span> : null}
                        {item.selectedColor ? <span>{item.selectedColor}</span> : null}
                        {item.sku ? <span>SKU {item.sku}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-black text-slate-950">
                          {formatCurrency(Number(item.price || 0))}
                        </span>
                        <span className="font-semibold text-slate-500">
                          Line total {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {!isOpen && order.items.length > visibleItems.length ? (
                  <p className="px-1 text-sm font-semibold text-slate-500">
                    +{order.items.length - visibleItems.length} more item
                    {order.items.length - visibleItems.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>

              <aside className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <ReceiptText className="h-4 w-4 text-teal-700" />
                    Bill summary
                  </div>
                  <PriceRow label="Subtotal" value={order.subtotal} />
                  <PriceRow label="Discount" value={-Math.abs(Number(order.discount || 0))} tone="save" />
                  <PriceRow label="Shipping" value={order.shippingCharge} />
                  {order.couponCode ? <PriceText label="Coupon" value={order.couponCode} /> : null}
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <PriceRow label="Total paid/order value" value={order.total} strong />
                  </div>
                </div>

                {isOpen ? (
                  <div className="rounded-md border border-slate-200 bg-slate-950 p-4 text-white">
                    <div className="flex items-center gap-2 text-sm font-black">
                      <MapPin className="h-4 w-4 text-teal-300" />
                      Delivery address
                    </div>
                    <p className="mt-3 text-sm font-semibold">{order.shippingAddress?.fullName ?? "Customer"}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatAddress(order.shippingAddress)}
                    </p>
                    {order.shippingAddress?.phone ? (
                      <p className="mt-2 text-sm text-slate-300">Phone: {order.shippingAddress.phone}</p>
                    ) : null}
                  </div>
                ) : null}
              </aside>
            </div>

            {isOpen ? (
              <div className="border-t border-slate-200 px-5 pb-5">
                <OrderTimeline orderStatus={summary.normalizedOrderStatus} createdAt={placedDate} />
                {order.razorpayPaymentId ? (
                  <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900">
                    Razorpay payment ID: {order.razorpayPaymentId}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-600">
                {summary.nextMessage}
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.canRetryPayment ? (
                  <Link
                    href="/checkout"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-600"
                  >
                    Retry payment
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpenOrderId(isOpen ? null : order.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                >
                  {isOpen ? "Hide details" : "View details"}
                  <ChevronDown className={cn("h-4 w-4 transition", isOpen ? "rotate-180" : "")} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <Icon className="h-4 w-4 text-teal-700" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong = false,
  tone
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "save";
}) {
  return (
    <div className={cn("mt-3 flex items-center justify-between gap-4 text-sm", strong && "text-base")}>
      <span className="font-semibold text-slate-600">{label}</span>
      <span className={cn("font-black text-slate-950", tone === "save" && Number(value) < 0 && "text-emerald-700")}>
        {formatCurrency(Number(value || 0))}
      </span>
    </div>
  );
}

function PriceText({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-4 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="font-black uppercase text-teal-700">{value}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "amber" && "bg-amber-100 text-amber-800",
        tone === "red" && "bg-red-100 text-red-800",
        tone === "blue" && "bg-blue-100 text-blue-800"
      )}
    >
      {tone === "green" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function OrderTimeline({ orderStatus, createdAt }: { orderStatus: string; createdAt: Date }) {
  const steps = buildTrackingSteps(orderStatus, createdAt);

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-black text-slate-950">
        <Truck className="h-4 w-4 text-teal-700" />
        Order journey
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative rounded-md border border-slate-200 bg-slate-50 p-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-white",
                step.active ? "bg-emerald-600" : "bg-slate-300"
              )}
            >
              {step.icon === "home" ? <Home className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            </div>
            <p className="mt-3 text-sm font-black text-slate-950">{step.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {index === 0 ? formatShortDate(createdAt) : step.hint}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getOrderSummary(order: OrderHistoryOrder) {
  const normalizedPaymentMethod = String(order.paymentMethod ?? "").toLowerCase();
  const normalizedPaymentStatus = String(order.paymentStatus ?? "pending").toLowerCase();
  const normalizedOrderStatus = String(order.orderStatus ?? "pending").toLowerCase();
  const isOnline =
    normalizedPaymentMethod === "online" || normalizedPaymentMethod === "online payment";
  const canRetryPayment = isOnline && ["pending", "failed"].includes(normalizedPaymentStatus);

  if (isOnline && normalizedPaymentStatus === "failed") {
    return {
      normalizedOrderStatus,
      orderLabel: "Payment failed",
      paymentLabel: "Online payment",
      paymentStatusLabel: "Failed",
      deliveryLabel: "On hold",
      tone: "red" as const,
      canRetryPayment,
      nextMessage: "Payment did not complete. Retry payment to confirm this order."
    };
  }

  if (isOnline && normalizedPaymentStatus === "pending") {
    return {
      normalizedOrderStatus,
      orderLabel: "Payment pending",
      paymentLabel: "Online payment",
      paymentStatusLabel: "Pending",
      deliveryLabel: "Awaiting payment",
      tone: "amber" as const,
      canRetryPayment,
      nextMessage: "Complete payment so the order can move ahead."
    };
  }

  if (normalizedOrderStatus === "delivered") {
    return {
      normalizedOrderStatus,
      orderLabel: "Delivered",
      paymentLabel: isOnline ? "Online payment" : "Cash on delivery",
      paymentStatusLabel: normalizedPaymentStatus === "paid" ? "Paid" : "Pay on delivery",
      deliveryLabel: "Delivered",
      tone: "green" as const,
      canRetryPayment: false,
      nextMessage: "Delivered successfully. Thank you for shopping with Vrixo."
    };
  }

  return {
    normalizedOrderStatus,
    orderLabel: normalizedPaymentStatus === "paid" ? "Confirmed / paid" : titleCase(normalizedOrderStatus || "confirmed"),
    paymentLabel: isOnline ? "Online payment" : "Cash on delivery",
    paymentStatusLabel:
      !isOnline && normalizedPaymentStatus === "cod_pending"
        ? "Pay on delivery"
        : normalizedPaymentStatus === "paid"
          ? "Paid"
          : titleCase(normalizedPaymentStatus || "Pending"),
    deliveryLabel: titleCase(normalizedOrderStatus || "Confirmed"),
    tone: normalizedOrderStatus === "cancelled" ? ("red" as const) : ("blue" as const),
    canRetryPayment: false,
    nextMessage:
      normalizedOrderStatus === "cancelled"
        ? "This order was cancelled."
        : "We will keep this order updated as it moves through packing and delivery."
  };
}

function buildTrackingSteps(orderStatus: string, createdAt: Date) {
  const rank = getStatusRank(orderStatus);
  return [
    { label: "Placed", hint: "Order received", active: rank >= 1, icon: "home" },
    { label: "Packed", hint: formatShortDate(addDays(createdAt, 1)), active: rank >= 2, icon: "truck" },
    { label: "Shipped", hint: formatShortDate(addDays(createdAt, 2)), active: rank >= 3, icon: "truck" },
    { label: "Delivered", hint: formatShortDate(addDays(createdAt, 4)), active: rank >= 5, icon: "home" }
  ];
}

function getStatusRank(status: string) {
  if (status === "delivered") return 5;
  if (status === "shipped") return 3;
  if (status === "packed" || status === "processing") return 2;
  if (status === "cancelled") return 0;
  return 1;
}

function formatAddress(address?: Partial<Address> | null) {
  if (!address) return "Delivery address is saved with this order.";

  return [
    address.line1,
    address.line2,
    address.landmark,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ]
    .filter(Boolean)
    .join(", ");
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
