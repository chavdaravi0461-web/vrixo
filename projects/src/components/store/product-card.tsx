"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Eye, Star, Loader2 } from "lucide-react";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { normalizeProductImage, getFallbackProductImage } from "@/lib/product-images";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { useState, memo } from "react";
import { toast } from "sonner";
import type { Product } from "@/types/index";

const ProductCardUnmemoized = ({ product, index = 0 }: { product: Product; index?: number }) => {
  const img = normalizeProductImage(product.images?.[0]);
  const secondImg = normalizeProductImage(product.images?.[1]);
  const hasDiscount = product.discountPercent > 0 && product.originalPrice > product.price;
  const inStock = (product.stock ?? 0) > 0;
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const wished = useWishlistStore((s) => s.ids.includes(product.id));
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding] = useState(false);
  const requiresSelection = Boolean(product.sizes?.length || product.colors?.length);
  const displayTitle = cleanProductTitle(product.title);
  const showFallback = !img || imgFailed;

  const handleAdd = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!inStock) {
      toast.error("This product is currently out of stock.");
      return;
    }
    setAdding(true);
    addItem({
      productId: product.id, slug: product.slug, title: product.title,
      image: img ?? "", price: product.price, quantity: 1, stock: product.stock ?? 0,
    });
    toast.success(`${displayTitle} added to cart`);
    setTimeout(() => setAdding(false), 600);
  };

  const delay = Math.min(index * 0.05, 0.3);

  return (
    <div
      className={`p-card anim-fade-up ${!inStock ? "opacity-60" : ""}`}
      style={{ animationDelay: `${delay}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-card-image">
        <Link href={`/product/${product.slug}`}>
          {showFallback ? (
            <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
              <Eye className="h-8 w-8 opacity-30" />
            </div>
          ) : (
            <>
              <Image
                src={hovered && secondImg ? secondImg : img}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                priority={index < 4}
                loading={index < 4 ? "eager" : "lazy"}
                quality={85}
                className="object-cover"
                onError={() => setImgFailed(true)}
              />
              {!inStock && <div className="absolute inset-0 bg-black/40 z-[1]" />}
            </>
          )}
        </Link>
        <div className="p-card-overlay" />
        <div className="p-card-badges">
          {product.bestseller && (
            <span className="p-card-badge p-card-badge-sale">Bestseller</span>
          )}
          {product.featured && !product.bestseller && (
            <span className="p-card-badge p-card-badge-featured">Featured</span>
          )}
          {product.newArrival && (
            <span className="p-card-badge p-card-badge-new">New Arrival</span>
          )}
          {hasDiscount && (
            <span className="p-card-badge p-card-badge-sale">-{product.discountPercent}%</span>
          )}
          {!inStock && (
            <span className="p-card-badge p-card-badge-sold">Sold out</span>
          )}
          {inStock && product.stock > 0 && product.stock <= 3 && (
            <span className="p-card-badge p-card-badge-sale">Only {product.stock} left</span>
          )}
        </div>
      </div>

      <button
        type="button"
        className="p-card-action"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist(product.id);
          toast.success(wished ? "Removed from wishlist" : `${cleanProductTitle(product.title)} added to wishlist`);
        }}
      >
        <Heart className={`h-[15px] w-[15px] transition-transform duration-300 ${wished ? "fill-[var(--accent)] text-[var(--accent)] scale-110" : "scale-100"}`} />
      </button>

      {requiresSelection ? (
        <Link href={`/product/${product.slug}`} className="p-card-actions">
          <span className="p-card-action">
            <Eye className="h-[15px] w-[15px]" />
          </span>
        </Link>
      ) : (
        <div className="p-card-actions">
          <button type="button" className="p-card-action" onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <ShoppingBag className="h-[15px] w-[15px]" />}
          </button>
        </div>
      )}

      <div className="p-card-body">
        <p className="p-card-category">{product.brand || product.category}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="p-card-title">{displayTitle}</h3>
        </Link>
        {product.rating > 0 ? (
          <div className="flex items-center gap-1" style={{ marginTop: "4px" }}>
            <Star className="h-3.5 w-3.5 fill-[var(--accent)]" style={{ color: "var(--accent)" }} />
            <span className="body-sm" style={{ fontSize: "12px" }}>{product.rating.toFixed(1)}</span>
            <span className="body-sm" style={{ fontSize: "11px", color: "var(--text-muted)" }}>({product.reviewCount})</span>
          </div>
        ) : null}
        <div className="p-card-price">
          {formatCurrency(product.price)}
          {hasDiscount && <span className="p-card-price-original">{formatCurrency(product.originalPrice)}</span>}
        </div>
        <button type="button" className="p-card-add" onClick={handleAdd} disabled={adding || !inStock}>
          {adding ? "Adding..." : inStock ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardUnmemoized);
