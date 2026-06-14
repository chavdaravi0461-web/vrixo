"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2, ChevronDown, Clock, CreditCard, Home,
  MapPin, Package, Receipt, Truck, Phone, ArrowLeft,
  Loader2, ShoppingBag, Heart, Ticket, Gift, LogOut, User
} from "lucide-react";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
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

  if (orders.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {localNotice && (
        <div style={{
          padding: "14px 18px", borderRadius: "var(--radius)",
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
          fontSize: "13px", color: "#f59e0b", fontWeight: 500,
        }}>
          These orders are saved on this device. Login to keep your order history.
        </div>
      )}

      {orders.map((order) => {
        const summary = getOrderSummary(order);
        const isOpen = openOrderId === order.id;
        const placedDate = new Date(order.createdAt);

        return (
          <div key={order.id} style={{
            borderRadius: "var(--radius)", border: "1px solid var(--border)",
            background: "var(--bg-card)", overflow: "hidden",
          }}>

            {/* Header */}
            <div style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%)",
              borderBottom: "1px solid var(--border)",
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px",
            }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <StatusBadge tone={summary.tone} label={summary.orderLabel} />
                  <span style={{
                    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
                    padding: "4px 10px", borderRadius: "999px",
                    border: "1px solid var(--border)", background: "var(--glass)",
                  }}>
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Order {order.orderNumber}
                </div>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", marginTop: "6px" }}>
                  {formatCurrency(Number(order.total || 0))}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Placed on {formatLongDate(placedDate)}
                </div>
              </div>

              {/* Info tiles */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <InfoTile icon={CreditCard} label="Payment" value={summary.paymentLabel} />
                <InfoTile icon={Package} label="Status" value={summary.paymentStatusLabel} />
                <InfoTile icon={Truck} label="Delivery" value={summary.deliveryLabel} />
              </div>
            </div>

            {/* Body */}
            {isOpen && (
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)" }}>

                  {/* Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${index}`} style={{
                        display: "grid", gridTemplateColumns: "72px 1fr", gap: "14px",
                        padding: "12px", borderRadius: "12px",
                        background: "var(--glass)", border: "1px solid var(--border)",
                      }}>
                        <div style={{
                          width: "72px", height: "72px", borderRadius: "10px", overflow: "hidden",
                          border: "1px solid var(--border)", flexShrink: 0,
                        }}>
                          <Image
                            src={normalizeProductImage(item.image) ?? getFallbackProductImage()}
                            alt={cleanProductTitle(item.title)}
                            width={144} height={144}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/product/${item.slug}`} style={{
                            fontSize: "14px", fontWeight: 600, color: "var(--text)",
                            textDecoration: "none", lineHeight: 1.4, display: "block",
                          }}>
                            {cleanProductTitle(item.title)}
                          </Link>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                            {[
                              item.quantity > 1 && `Qty ${item.quantity}`,
                              item.selectedSize && `Size ${item.selectedSize}`,
                              item.selectedColor && item.selectedColor,
                              item.sku && `SKU ${item.sku}`,
                            ].filter(Boolean).map((tag) => (
                              <span key={String(tag)} style={{
                                fontSize: "11px", fontWeight: 500, color: "var(--text-muted)",
                                padding: "2px 8px", borderRadius: "6px",
                                background: "var(--glass)", border: "1px solid var(--border)",
                              }}>{tag}</span>
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                              {formatCurrency(Number(item.price || 0))}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              x {item.quantity} = {formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sidebar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Bill summary */}
                    <div style={{
                      padding: "18px", borderRadius: "12px",
                      background: "var(--glass)", border: "1px solid var(--border)",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "14px",
                      }}>
                        <Receipt size={14} style={{ color: "var(--accent)" }} />
                        Bill summary
                      </div>
                      <PriceRow label="Subtotal" value={order.subtotal} />
                      {Number(order.discount || 0) > 0 && (
                        <PriceRow label="Discount" value={-Math.abs(Number(order.discount))} tone="save" />
                      )}
                      <PriceRow label="Shipping" value={order.shippingCharge} />
                      {order.couponCode && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "13px" }}>
                          <span style={{ color: "var(--text-muted)" }}>Coupon</span>
                          <span style={{ fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>{order.couponCode}</span>
                        </div>
                      )}
                      <div style={{ borderTop: "1px solid var(--border)", marginTop: "12px", paddingTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700 }}>
                          <span style={{ color: "var(--text)" }}>Total</span>
                          <span style={{ color: "var(--text)" }}>{formatCurrency(Number(order.total || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery address */}
                    <div style={{
                      padding: "18px", borderRadius: "12px",
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "12px",
                      }}>
                        <MapPin size={14} style={{ color: "var(--accent)" }} />
                        Delivery address
                      </div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
                        {order.shippingAddress?.fullName ?? "Customer"}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
                        {formatAddress(order.shippingAddress)}
                      </p>
                      {order.shippingAddress?.phone && (
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 0", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={12} /> {order.shippingAddress.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Journey */}
                <OrderTimeline orderStatus={summary.normalizedOrderStatus} createdAt={placedDate} />

                {order.razorpayPaymentId && (
                  <div style={{
                    marginTop: "14px", padding: "12px 16px", borderRadius: "10px",
                    background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
                    fontSize: "12px", fontWeight: 600, color: "#818cf8",
                  }}>
                    Razorpay payment ID: {order.razorpayPaymentId}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{
              padding: "14px 24px", borderTop: "1px solid var(--border)",
              background: "rgba(255,255,255,0.01)",
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                {summary.nextMessage}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                {summary.canRetryPayment && (
                  <Link href="/checkout" style={{
                    padding: "10px 20px", borderRadius: "10px",
                    background: "#f59e0b", color: "#000",
                    fontSize: "13px", fontWeight: 700, textDecoration: "none",
                  }}>Retry payment</Link>
                )}
                <button
                  onClick={() => setOpenOrderId(isOpen ? null : order.id)}
                  style={{
                    padding: "10px 20px", borderRadius: "10px",
                    background: "var(--glass)", border: "1px solid var(--border)",
                    color: "var(--text)", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {isOpen ? "Hide details" : "View details"}
                  <ChevronDown size={14} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{
      padding: "12px 16px", borderRadius: "10px",
      background: "var(--glass)", border: "1px solid var(--border)",
      minWidth: "120px",
    }}>
      <Icon size={14} style={{ color: "var(--accent)" }} />
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "8px" }}>
        {label}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginTop: "4px" }}>
        {value}
      </div>
    </div>
  );
}

function PriceRow({ label, value, tone }: { label: string; value: number; tone?: "save" }) {
  const isNegative = Number(value) < 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "13px" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{
        fontWeight: 700,
        color: tone === "save" && isNegative ? "#10b981" : "var(--text)",
      }}>
        {formatCurrency(Number(value || 0))}
      </span>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "blue" }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "rgba(16,185,129,0.1)", text: "#10b981", border: "rgba(16,185,129,0.25)" },
    amber: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.25)" },
    red: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", border: "rgba(239,68,68,0.25)" },
    blue: { bg: "rgba(99,102,241,0.1)", text: "#818cf8", border: "rgba(99,102,241,0.25)" },
  };
  const c = colors[tone] || colors.blue;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "5px 12px", borderRadius: "999px",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em",
    }}>
      {tone === "green" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
      {label}
    </span>
  );
}

function OrderTimeline({ orderStatus, createdAt }: { orderStatus: string; createdAt: Date }) {
  const steps = buildTrackingSteps(orderStatus, createdAt);

  return (
    <div style={{
      marginTop: "20px", padding: "20px", borderRadius: "12px",
      background: "var(--glass)", border: "1px solid var(--border)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "18px",
      }}>
        <Truck size={14} style={{ color: "var(--accent)" }} />
        Order journey
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {steps.map((step, index) => (
          <div key={step.label} style={{ position: "relative", textAlign: "center" }}>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div style={{
                position: "absolute", top: "16px", left: "calc(50% + 16px)", right: "calc(-50% + 16px)",
                height: "2px", background: step.active ? "var(--accent)" : "var(--border)",
              }} />
            )}
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: step.active ? "var(--accent)" : "var(--glass)",
              border: `2px solid ${step.active ? "var(--accent)" : "var(--border)"}`,
              color: step.active ? "var(--bg)" : "var(--text-muted)",
              position: "relative", zIndex: 1,
            }}>
              {step.icon === "home" ? <Home size={14} /> : <Truck size={14} />}
            </div>
            <div style={{
              marginTop: "10px", fontSize: "12px", fontWeight: 700,
              color: step.active ? "var(--text)" : "var(--text-muted)",
            }}>
              {step.label}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              {index === 0 ? formatShortDate(createdAt) : step.hint}
            </div>
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
  const isOnline = normalizedPaymentMethod === "online" || normalizedPaymentMethod === "online payment";
  const canRetryPayment = isOnline && ["pending", "failed"].includes(normalizedPaymentStatus);

  if (isOnline && normalizedPaymentStatus === "failed") {
    return { normalizedOrderStatus, orderLabel: "Payment failed", paymentLabel: "Online payment", paymentStatusLabel: "Failed", deliveryLabel: "On hold", tone: "red" as const, canRetryPayment, nextMessage: "Payment did not complete. Retry to confirm this order." };
  }
  if (isOnline && normalizedPaymentStatus === "pending") {
    return { normalizedOrderStatus, orderLabel: "Payment pending", paymentLabel: "Online payment", paymentStatusLabel: "Pending", deliveryLabel: "Awaiting", tone: "amber" as const, canRetryPayment, nextMessage: "Complete payment so the order can move ahead." };
  }
  if (normalizedOrderStatus === "delivered") {
    return { normalizedOrderStatus, orderLabel: "Delivered", paymentLabel: isOnline ? "Online payment" : "Cash on delivery", paymentStatusLabel: normalizedPaymentStatus === "paid" ? "Paid" : "COD", deliveryLabel: "Delivered", tone: "green" as const, canRetryPayment: false, nextMessage: "Delivered successfully. Thank you for shopping with Vrixo." };
  }
  if (normalizedOrderStatus === "cancelled") {
    return { normalizedOrderStatus, orderLabel: "Cancelled", paymentLabel: isOnline ? "Online payment" : "Cash on delivery", paymentStatusLabel: titleCase(normalizedPaymentStatus || "Pending"), deliveryLabel: "Cancelled", tone: "red" as const, canRetryPayment: false, nextMessage: "This order was cancelled." };
  }
  return {
    normalizedOrderStatus,
    orderLabel: normalizedPaymentStatus === "paid" ? "Confirmed" : titleCase(normalizedOrderStatus || "Confirmed"),
    paymentLabel: isOnline ? "Online payment" : "Cash on delivery",
    paymentStatusLabel: !isOnline && normalizedPaymentStatus === "cod_pending" ? "Pay on delivery" : normalizedPaymentStatus === "paid" ? "Paid" : titleCase(normalizedPaymentStatus || "Pending"),
    deliveryLabel: titleCase(normalizedOrderStatus || "Confirmed"),
    tone: "blue" as const,
    canRetryPayment: false,
    nextMessage: "We will keep this order updated as it moves through packing and delivery."
  };
}

function buildTrackingSteps(orderStatus: string, createdAt: Date) {
  const rank = getStatusRank(orderStatus);
  return [
    { label: "Placed", hint: "Order received", active: rank >= 1, icon: "home" },
    { label: "Packed", hint: formatShortDate(addDays(createdAt, 1)), active: rank >= 2, icon: "truck" },
    { label: "Shipped", hint: formatShortDate(addDays(createdAt, 2)), active: rank >= 3, icon: "truck" },
    { label: "Delivered", hint: formatShortDate(addDays(createdAt, 4)), active: rank >= 5, icon: "home" },
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
  if (!address) return "Delivery address saved with this order.";
  return [address.line1, address.line2, address.landmark, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ");
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
