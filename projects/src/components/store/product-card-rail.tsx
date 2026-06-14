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
    <div className="p-card anim-fade-up">
      <Link href={`/product/${product.slug}`} className="block p-card-image" style={{ aspectRatio: "4/5" }}>
        <Image src={img} alt={product.title} fill sizes="220px" className="object-cover" loading="lazy" />
        <div className="p-card-overlay" />
        {hasDiscount && (
          <span className="p-card-badge p-card-badge-sale" style={{ top: "8px", left: "8px" }}>
            -{product.discountPercent}%
          </span>
        )}
        {!inStock && (
          <span className="p-card-badge p-card-badge-sold" style={{ top: "8px", left: "8px" }}>
            Sold out
          </span>
        )}
      </Link>

      <div style={{ position: "absolute", top: "8px", right: "8px", opacity: 1, transform: "none" }}>
        <button
          type="button"
          className="p-card-action"
          style={{ width: "30px", height: "30px" }}
          aria-label="Quick add"
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

      <div className="p-card-body" style={{ padding: "10px 0 0" }}>
        <p className="p-card-category" style={{ fontSize: "9px" }}>{product.brand || product.category}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="p-card-title" style={{ fontSize: "13px" }}>{displayTitle}</h3>
        </Link>
        <div className="p-card-price" style={{ fontSize: "13px" }}>
          {formatCurrency(product.price)}
          {hasDiscount && <span className="p-card-price-original" style={{ fontSize: "11px" }}>{formatCurrency(product.originalPrice)}</span>}
        </div>
      </div>
    </div>
  );
}
