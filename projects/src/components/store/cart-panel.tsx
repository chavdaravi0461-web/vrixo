"use client";

import { X, Minus, Plus, ShoppingBag, Truck, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

const FREE_SHIPPING_THRESHOLD = 999;

export function CartPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const total = useMemo(() => items.reduce((t, i) => t + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((t, i) => t + i.quantity, 0), [items]);
  const freeShippingProgress = Math.min((total / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - total, 0);

  if (!open) return null;

  return (
    <>
      <div className="cart-overlay" onClick={onClose} aria-hidden="true" />
      <div className="cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart" aria-live="polite">
        <div className="cart-header">
          <span className="cart-title">Cart ({count})</span>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close cart">
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Truck size={14} style={{ color: total >= FREE_SHIPPING_THRESHOLD ? "var(--accent)" : "var(--text-muted)" }} />
              <span style={{ fontSize: "12px", color: total >= FREE_SHIPPING_THRESHOLD ? "var(--accent)" : "var(--text-secondary)" }}>
                {total >= FREE_SHIPPING_THRESHOLD ? "Free shipping unlocked!" : `Add ${formatCurrency(amountToFreeShipping)} more for free shipping`}
              </span>
            </div>
            <div className="shipping-bar">
              <div className="shipping-bar-fill" style={{ width: `${freeShippingProgress}%` }} />
            </div>
          </div>
        )}

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4" style={{ padding: "40px 20px" }} role="status">
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(245,245,242,.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag className="h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
              </div>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text)", marginBottom: "4px" }}>Your cart is empty</p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Discover premium styles waiting for you</p>
              </div>
              <Link href="/shop" className="hero-btn hero-btn-primary" style={{ fontSize: "13px", padding: "10px 24px" }} onClick={onClose}>
                Start shopping
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={`${item.productId}-${item.selectedSize ?? "nosize"}-${item.selectedColor ?? "nocolor"}`} className="cart-item" style={{ animation: "fade-in .3s ease" }}>
                <div className="cart-item-image">
                  {item.image && <Image src={item.image} alt={item.title} width={64} height={64} loading="lazy" style={{ borderRadius: "8px", objectFit: "cover" }} />}
                </div>
                <div className="cart-item-info">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="cart-item-title">{item.title}</div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, item.selectedSize, item.selectedColor)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", transition: "color .2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dc-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      aria-label="Remove item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="cart-item-price">{formatCurrency(item.price)}</div>
                  {(item.selectedSize || item.selectedColor) && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {[item.selectedSize, item.selectedColor].filter(Boolean).join(" / ")}
                    </div>
                  )}
                  <div className="cart-item-qty" role="group" aria-label={`Quantity for ${item.title}`}>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      aria-label={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                      onClick={() => {
                        if (item.quantity <= 1) removeItem(item.productId, item.selectedSize, item.selectedColor);
                        else updateQuantity(item.productId, item.quantity - 1, item.selectedSize, item.selectedColor);
                      }}
                    >
                      <Minus className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <span className="cart-qty-value" aria-label={`Quantity: ${item.quantity}`}>{item.quantity}</span>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      disabled={item.stock ? item.quantity >= item.stock : false}
                      aria-label="Increase quantity"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.selectedSize, item.selectedColor)}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-value">{formatCurrency(total)}</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", textAlign: "center" }}>
              Estimated delivery: 3-5 business days
            </div>
            <Link href="/checkout" className="cart-checkout btn-glow" style={{ display: "block", textAlign: "center", textDecoration: "none" }} onClick={onClose}>
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
