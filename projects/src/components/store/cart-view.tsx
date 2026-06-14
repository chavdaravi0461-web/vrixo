"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CouponBox } from "@/components/store/coupon-box";
import { useCartStore } from "@/lib/store/cart-store";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { ShippingSettings } from "@/lib/order-pricing";

function useDebounce(ms = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }, [ms]);
}

export function CartView({ shippingSettings }: { shippingSettings: ShippingSettings }) {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const discount = useCartStore((state) => state.discount);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const shipping = calculateShippingCharge(subtotal, items, shippingSettings);
  const total = Math.max(0, subtotal + shipping - discount);
  const debounce = useDebounce(250);

  if (!hasHydrated) {
    return <CartViewSkeleton />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.productId}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`}
            className="glass-card"
            style={{ padding: "16px" }}
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative h-32 w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] md:w-32">
                <Image
                  src={normalizeProductImage(item.image) ?? getFallbackProductImage()}
                  alt={cleanProductTitle(item.title)}
                  fill
                  sizes="(min-width: 768px) 128px, 100vw"
                  className="object-contain p-2"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <Link href={`/product/${item.slug}`} className="p-card-title hover:text-[var(--accent)]">
                      {cleanProductTitle(item.title)}
                    </Link>
                    <div className="flex flex-wrap gap-3 text-sm" style={{ marginTop: "8px", color: "var(--text-muted)" }}>
                      {item.selectedSize ? <span>Size {item.selectedSize}</span> : null}
                      {item.selectedColor ? <span>{item.selectedColor}</span> : null}
                    </div>
                    <p className="p-card-price" style={{ marginTop: "12px" }}>
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 self-start text-sm font-medium"
                    style={{ color: "var(--text-muted)" }}
                    onClick={() => removeItem(item.productId, item.selectedSize, item.selectedColor)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
                <div className="inline-flex items-center" style={{ marginTop: "16px", border: "1px solid var(--border)", borderRadius: "999px", padding: "2px" }}>
                  <button
                    type="button"
                    className="rounded-full p-1.5 transition hover:bg-[var(--glass-hover)]"
                    style={{ color: "var(--text-secondary)" }}
                    onClick={() => {
                      if (item.quantity <= 1) removeItem(item.productId, item.selectedSize, item.selectedColor);
                      else debounce(() => updateQuantity(item.productId, item.quantity - 1, item.selectedSize, item.selectedColor));
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    className="rounded-full p-1.5 transition hover:bg-[var(--glass-hover)]"
                    disabled={item.stock ? item.quantity >= item.stock : false}
                    style={{ color: "var(--text-secondary)" }}
                    onClick={() => debounce(() => updateQuantity(item.productId, item.quantity + 1, item.selectedSize, item.selectedColor))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="glass-card" style={{ padding: "24px", position: "sticky", top: "96px", alignSelf: "start", height: "fit-content" }}>
        <h2 className="display-md" style={{ fontSize: "18px", letterSpacing: "-.015em", marginBottom: "20px" }}>Order Summary</h2>
        <div className="body-sm" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <div className="flex items-center justify-between" style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-.01em" }}>
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        <Link href="/checkout" style={{ display: "block", marginTop: "24px" }}>
          <Button className="h-11 w-full" disabled={items.length === 0}>
            Proceed to checkout
          </Button>
        </Link>
        {items.length > 0 ? <CouponBox subtotal={subtotal} /> : null}
        <div style={{ marginTop: "16px", padding: "12px", borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {shippingSettings.mode === "free"
            ? "Free shipping is active on every order."
            : `Shipping charge is ${formatCurrency(shippingSettings.shippingCharge)}.`} Cash on Delivery is available by default.
        </div>
      </div>
    </div>
  );
}

function CartViewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]" aria-label="Loading cart">
      <div className="space-y-3">
        {[0, 1].map((item) => (
          <div key={item} className="glass-card" style={{ padding: "16px" }}>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="h-32 w-full animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] md:w-32" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-2/3 animate-pulse rounded-full bg-[var(--bg-secondary)]" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--bg-secondary)]" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--bg-secondary)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="glass-card" style={{ padding: "24px" }}>
        <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--bg-secondary)]" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-[var(--bg-secondary)]" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-[var(--bg-secondary)]" />
        <div className="mt-6 h-11 w-full animate-pulse rounded-full bg-[var(--bg-secondary)]" />
      </div>
    </div>
  );
}
