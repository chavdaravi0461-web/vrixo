import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_CHARGE,
  TEST_PAYMENT_PRODUCT_SLUG
} from "@/lib/constants";
import type { CartItem } from "@/types/index";

export function calculateCartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

type ShippingItem = Pick<CartItem, "productId" | "slug">;

export type ShippingSettings = {
  mode: "free" | "paid";
  shippingCharge: number;
  freeShippingThreshold: number;
};

export function calculateShippingCharge(
  subtotal: number,
  items: ShippingItem[] = [],
  settings: ShippingSettings = {
    mode: "paid",
    shippingCharge: SHIPPING_CHARGE,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD
  }
) {
  if (subtotal <= 0 || isOnlyTestPaymentProduct(items)) {
    return 0;
  }

  if (settings.mode === "free") {
    return 0;
  }

  return settings.shippingCharge;
}

function isOnlyTestPaymentProduct(items: ShippingItem[]) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.slug === TEST_PAYMENT_PRODUCT_SLUG || item.productId === "test-payment-5"
    )
  );
}
