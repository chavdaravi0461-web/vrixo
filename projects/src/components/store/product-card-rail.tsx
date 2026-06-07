"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { useCartStore } from "@/lib/store/cart-store";
import { toast } from "sonner";
import type { Product } from "@/types/index";

export function ProductCardRail({ product }: { product: Product }) {
  const img = normalizeProductImage(product.images?.[0]) ?? getFallbackProductImage();
  const hasDiscount = product.discountPercent > 0 && product.originalPrice > product.price;
  const inStock = (product.stock ?? 0) > 0;
  const addItem = useCartStore((state) => state.addItem);
  const displayTitle = cleanProductTitle(product.title);
  const requiresSelection = Boolean(product.sizes?.length || product.colors?.length);

  return (
    <div className="dc-card-luxe anim-fade-up-fast">
      <Link href={`/product/${product.slug}`} className="block dc-card-luxe-image" style={{ aspectRatio: "4/5" }}>
        <Image src={img} alt={product.title} fill sizes="220px" className="object-cover" loading="lazy" />
        <div className="dc-card-luxe-overlay" />
        {hasDiscount && (
          <span className="absolute top-2 left-2 z-10 dc-badge-luxe text-[var(--dc-danger)] border-[var(--dc-danger)] text-[8px]">
            -{product.discountPercent}%
          </span>
        )}
        {!inStock && (
          <span className="absolute top-2 left-2 z-10 dc-badge-luxe text-[var(--dc-muted)] border-[var(--dc-border)] text-[8px]">
            Sold out
          </span>
        )}
      </Link>

      <div className="dc-card-luxe-actions" style={{ bottom: "auto", top: "8px", left: "auto", right: "8px", opacity: 1, transform: "none" }}>
        <button
          type="button"
          className="dc-card-luxe-btn dc-card-luxe-btn-secondary"
          style={{ padding: "6px 10px", fontSize: "10px", flex: "none" }}
          aria-label={requiresSelection ? "Quick add" : "Quick add"}
          disabled={!inStock}
          onClick={() => {
            if (requiresSelection) {
              toast.message("Choose size or color on the product page.");
              return;
            }
            addItem({
              productId: product.id, slug: product.slug, title: product.title,
              image: img, price: product.price, quantity: 1, stock: product.stock ?? 0,
            });
            toast.success(`${displayTitle} added to cart`);
          }}
        >
          <ShoppingBag className="h-3 w-3" />
        </button>
      </div>

      <div className="dc-card-luxe-body" style={{ padding: "10px 0 0" }}>
        <p className="dc-card-luxe-brand" style={{ fontSize: "9px" }}>{product.brand || product.category}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="dc-card-luxe-title" style={{ fontSize: "13px" }}>{displayTitle}</h3>
        </Link>
        <div className="dc-card-luxe-price" style={{ fontSize: "13px" }}>
          {formatCurrency(product.price)}
          {hasDiscount && <span className="original" style={{ fontSize: "11px" }}>{formatCurrency(product.originalPrice)}</span>}
        </div>
      </div>
    </div>
  );
}
