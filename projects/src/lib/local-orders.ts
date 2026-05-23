import type { Address, CartItem, Order } from "@/types/index";
import { makeOrderNumber } from "@/lib/utils";

const LOCAL_ORDERS_STORAGE_KEY = "vrixo-local-orders";

export function createLocalOrder(input: {
  items: CartItem[];
  shippingAddress: Omit<Address, "id"> & {
    email?: string;
    couponCode?: string;
    paymentMethod?: Order["paymentMethod"];
  };
  couponCode?: string;
  discount: number;
  shippingCharge: number;
}) {
  const now = new Date().toISOString();
  const orderNumber = makeOrderNumber();
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + input.shippingCharge - input.discount;

  const order: Order = {
    id: safeId(),
    orderNumber,
    userId: "guest-local",
    items: input.items,
    subtotal,
    discount: input.discount,
    shippingCharge: input.shippingCharge,
    total,
    paymentMethod: "cod",
    paymentStatus: "cod_pending",
    orderStatus: "Confirmed",
    shippingAddress: {
      id: safeId(),
      fullName: input.shippingAddress.fullName,
      phone: input.shippingAddress.phone,
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2,
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      postalCode: input.shippingAddress.postalCode,
      country: input.shippingAddress.country,
      landmark: input.shippingAddress.landmark
    },
    customerName: input.shippingAddress.fullName,
    customerPhone: input.shippingAddress.phone,
    couponCode: input.couponCode || null,
    createdAt: now,
    updatedAt: now,
    smsStatus: "not-configured"
  };

  return order;
}

export function getLocalOrders() {
  if (typeof window === "undefined") {
    return [] as Order[];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_ORDERS_STORAGE_KEY);
    if (!raw) {
      return [] as Order[];
    }

    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as Order[];
  }
}

export function saveLocalOrder(order: Order) {
  if (typeof window === "undefined") {
    return;
  }

  const orders = getLocalOrders();
  window.localStorage.setItem(
    LOCAL_ORDERS_STORAGE_KEY,
    JSON.stringify([order, ...orders])
  );
}

function safeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
