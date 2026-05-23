"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { OrderHistoryCards, type OrderHistoryOrder } from "@/components/store/order-history-cards";
import { getLocalOrders } from "@/lib/local-orders";
import type { Order } from "@/types/index";

export function LocalOrdersPageClient() {
  const [orders] = useState<Order[]>(() =>
    typeof window === "undefined" ? [] : getLocalOrders()
  );

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Complete checkout to see your orders here."
        ctaLabel="Start shopping"
        ctaHref="/shop"
      />
    );
  }

  return (
    <OrderHistoryCards orders={orders.map(mapLocalOrder)} localNotice />
  );
}

function mapLocalOrder(order: Order): OrderHistoryOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    items: order.items,
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount ?? 0),
    shippingCharge: Number(order.shippingCharge ?? 0),
    total: Number(order.total ?? 0),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    shippingAddress: order.shippingAddress,
    couponCode: order.couponCode,
    createdAt: order.createdAt,
    smsStatus: order.smsStatus
  };
}
