"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Eye } from "lucide-react";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { normalizeProductImage } from "@/lib/product-images";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/types/index";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const img = normalizeProductImage(product.images?.[0]);
  const hasDiscount = product.discountPercent > 0 && product.originalPrice > product.price;
  const inStock = (product.stock ?? 0) > 0;
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wished = useWishlistStore((s) => s.ids.includes(product.id));
  const [imgFailed, setImgFailed] = useState(false);
  const requiresSelection = Boolean(product.sizes?.length || product.colors?.length);
  const displayTitle = cleanProductTitle(product.title);
  const showFallback = !img || imgFailed;

  const handleAdd = () => {
    if (!inStock) {
      toast.error("This product is currently out of stock.");
      return;
    }
    addItem({
      productId: product.id, slug: product.slug, title: product.title,
      image: img ?? "", price: product.price, quantity: 1, stock: product.stock ?? 0,
    });
    toast.success(`${displayTitle} added to cart`);
  };

  const delay = Math.min(index * 0.05, 0.3);

  return (
    <div
      className="dc-card-luxe group anim-fade-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <Link href={`/product/${product.slug}`} className="block dc-card-luxe-image">
        {showFallback ? (
          <div className="flex h-full w-full items-center justify-center text-[var(--dc-muted-2)]">
            <Eye className="h-8 w-8 opacity-30" />
          </div>
        ) : (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={index < 4}
            loading={index < 4 ? "eager" : "lazy"}
            quality={85}
            className="object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        <div className="dc-card-luxe-overlay" />
        {hasDiscount && (
          <span className="absolute top-3 left-3 z-10 dc-badge-luxe text-[var(--dc-danger)] border-[var(--dc-danger)]">
            -{product.discountPercent}%
          </span>
        )}
        {!inStock && (
          <span className="absolute top-3 left-3 z-10 dc-badge-luxe text-[var(--dc-muted)] border-[var(--dc-border)]">
            Sold out
          </span>
        )}
      </Link>

      <button
        type="button"
        className="dc-card-luxe-wish z-10"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist(product.id);
          toast.success(wished ? "Removed from wishlist" : `${cleanProductTitle(product.title)} added to wishlist`);
        }}
      >
        <Heart className={wished ? "fill-red-500 text-red-500" : ""} />
      </button>

      {requiresSelection ? (
        <Link
          href={`/product/${product.slug}`}
          className="dc-card-luxe-actions"
        >
          <span className="dc-card-luxe-btn dc-card-luxe-btn-primary">
            <Eye className="h-3.5 w-3.5" /> View options
          </span>
        </Link>
      ) : (
        <div className="dc-card-luxe-actions">
          <button
            type="button"
            className="dc-card-luxe-btn dc-card-luxe-btn-primary"
            onClick={handleAdd}
          >
            <ShoppingBag className="h-3.5 w-3.5" /> {inStock ? "Add to cart" : "Sold out"}
          </button>
        </div>
      )}

      <div className="dc-card-luxe-body">
        <p className="dc-card-luxe-brand">{product.brand || product.category}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="dc-card-luxe-title">{displayTitle}</h3>
        </Link>
        <div className="dc-card-luxe-price">
          {formatCurrency(product.price)}
          {hasDiscount && <span className="original">{formatCurrency(product.originalPrice)}</span>}
        </div>
      </div>
    </div>
  );
}
