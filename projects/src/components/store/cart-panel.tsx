"use client";

import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import Link from "next/link";

export function CartPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const total = useMemo(() => items.reduce((t, i) => t + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((t, i) => t + i.quantity, 0), [items]);

  if (!open) return null;

  return (
    <>
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="cart-header">
          <span className="cart-title">Cart ({count})</span>
          <button type="button" className="cart-close" onClick={onClose} aria-label="Close cart">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <ShoppingBag className="h-8 w-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">Your cart is empty</p>
              <Link href="/shop" className="text-sm underline" style={{ color: "var(--accent)" }} onClick={onClose}>
                Continue shopping
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="cart-item">
                <div className="cart-item-image">
                  {item.image && <img src={item.image} alt={item.title} />}
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-title">{item.title}</div>
                  <div className="cart-item-price">{formatCurrency(item.price)}</div>
                  <div className="cart-item-qty">
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() => {
                        if (item.quantity <= 1) removeItem(item.productId);
                        else updateQuantity(item.productId, item.quantity - 1);
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="cart-qty-value">{item.quantity}</span>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      disabled={item.stock ? item.quantity >= item.stock : false}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
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
            <Link href="/checkout" className="cart-checkout" style={{ display: "block", textAlign: "center", textDecoration: "none" }} onClick={onClose}>
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
