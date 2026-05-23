"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CouponBox } from "@/components/store/coupon-box";
import { useCartStore } from "@/lib/store/cart-store";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { ShippingSettings } from "@/lib/order-pricing";

export function CartView({ shippingSettings }: { shippingSettings: ShippingSettings }) {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const discount = useCartStore((state) => state.discount);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const shipping = calculateShippingCharge(subtotal, items, shippingSettings);
  const total = subtotal + shipping - discount;

  if (!hasHydrated) {
    return <CartViewSkeleton />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={`${item.productId}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`}
            className="dc-soft-panel p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative h-36 w-full overflow-hidden rounded-[var(--dc-radius-md)] bg-[var(--dc-cream)] md:w-36">
                <Image
                  src={normalizeProductImage(item.image) ?? getFallbackProductImage()}
                  alt={cleanProductTitle(item.title)}
                  fill
                  sizes="(min-width: 768px) 128px, 100vw"
                  className="object-contain p-3"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <Link href={`/product/${item.slug}`} className="text-lg font-black text-[var(--dc-black)] hover:text-[var(--dc-gold)]">
                      {cleanProductTitle(item.title)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--dc-muted)]">
                      {item.selectedSize ? <span>Size {item.selectedSize}</span> : null}
                      {item.selectedColor ? <span>{item.selectedColor}</span> : null}
                    </div>
                    <p className="mt-3 text-lg font-black text-[var(--dc-black)]">
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 self-start text-sm font-bold text-[var(--dc-danger)]"
                    onClick={() =>
                      removeItem(item.productId, item.selectedSize, item.selectedColor)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
                <div className="mt-6 inline-flex items-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-cream)] p-1">
                  <button
                    type="button"
                    className="rounded-full p-2 transition hover:bg-white"
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.quantity - 1,
                        item.selectedSize,
                        item.selectedColor
                      )
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-full p-2 transition hover:bg-white"
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.quantity + 1,
                        item.selectedSize,
                        item.selectedColor
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dc-soft-panel p-5 lg:sticky lg:top-32 lg:self-start">
        <h2 className="text-lg font-black uppercase tracking-[0.14em] text-[var(--dc-black)]">Order Summary</h2>
        <div className="mt-6 space-y-4 text-sm text-[var(--dc-muted)]">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span>- {formatCurrency(discount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span>
          </div>
          <div className="border-t border-[var(--dc-border)] pt-4">
            <div className="flex items-center justify-between text-lg font-black text-[var(--dc-black)]">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        <Link href="/checkout" className="mt-6 block">
          <Button className="h-12 w-full" disabled={items.length === 0}>
            Proceed to checkout
          </Button>
        </Link>
        {items.length > 0 ? <CouponBox subtotal={subtotal} /> : null}
        <p className="mt-4 rounded-[var(--dc-radius-md)] border border-[#f3d7a0] bg-[var(--dc-cream)] p-4 text-xs leading-6 text-[var(--dc-muted)]">
          {shippingSettings.mode === "free"
            ? "Free shipping is active on every order."
            : `Shipping charge is ${formatCurrency(shippingSettings.shippingCharge)}.`} Cash on Delivery
          is available by default.
        </p>
      </div>
    </div>
  );
}

function CartViewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]" aria-label="Loading cart">
      <div className="space-y-4">
        {[0, 1].map((item) => (
          <div key={item} className="dc-soft-panel p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="h-36 w-full animate-pulse rounded-[var(--dc-radius-md)] bg-[var(--dc-cream)] md:w-36" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-2/3 animate-pulse rounded-full bg-[var(--dc-cream)]" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--dc-cream)]" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--dc-cream)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dc-soft-panel space-y-4 p-5">
        <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--dc-cream)]" />
        <div className="h-4 w-full animate-pulse rounded-full bg-[var(--dc-cream)]" />
        <div className="h-4 w-5/6 animate-pulse rounded-full bg-[var(--dc-cream)]" />
        <div className="h-12 w-full animate-pulse rounded-full bg-[var(--dc-cream)]" />
      </div>
    </div>
  );
}
