"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowRight } from "lucide-react";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";

export function WishlistPageClient({ products }: { products: Product[] }) {
  const ids = useWishlistStore((state) => state.ids);
  const wishedProducts = useMemo(
    () => products.filter((product) => ids.includes(product.id)),
    [ids, products]
  );

  if (wishedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
          <Heart className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
        </div>
        <h2 className="display-md" style={{ fontSize: "20px", marginBottom: "8px" }}>Wishlist is empty</h2>
        <p className="body-sm" style={{ marginBottom: "20px" }}>Save products you like and come back anytime.</p>
        <Link href="/shop" className="hero-btn hero-btn-primary">
          Discover products <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="anim-fade-up" style={{ marginBottom: "24px" }}>
        <p className="eyebrow" style={{ color: "var(--accent)" }}>Collection</p>
        <h1 className="display-xl" style={{ fontSize: "clamp(24px, 4vw, 36px)", marginTop: "4px" }}>
          Your curated wishlist
        </h1>
        <p className="body-sm" style={{ marginTop: "4px" }}>{wishedProducts.length} saved {wishedProducts.length === 1 ? "item" : "items"}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 anim-stagger">
        {wishedProducts.map((product) => {
          const img = normalizeProductImage(product.images?.[0]);
          const hasDiscount = product.discountPercent > 0 && product.originalPrice > product.price;
          return (
            <Link key={product.id} href={`/product/${product.slug}`} className="glass-card-hover anim-fade-up" style={{ borderRadius: "var(--radius)", overflow: "hidden", textDecoration: "none", display: "block" }}>
              <div style={{ aspectRatio: "4/5", overflow: "hidden", background: "var(--bg-secondary)", position: "relative" }}>
                {img && <Image src={img} alt={product.title} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" style={{ transition: "transform .6s cubic-bezier(.33,1,.68,1)" }} />}
                <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2 }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(0,0,0,.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Heart className="h-3.5 w-3.5 fill-[var(--accent)]" style={{ color: "var(--accent)" }} />
                  </div>
                </div>
                {hasDiscount && (
                  <span className="p-card-badge p-card-badge-sale" style={{ position: "absolute", top: "12px", left: "12px" }}>-{product.discountPercent}%</span>
                )}
              </div>
              <div style={{ padding: "16px" }}>
                <p className="mono" style={{ color: "var(--text-muted)", fontSize: "9px", textTransform: "uppercase", letterSpacing: ".08em" }}>{product.brand || product.category}</p>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", marginTop: "4px", letterSpacing: "-.01em" }}>{cleanProductTitle(product.title)}</p>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginTop: "4px", letterSpacing: "-.01em" }}>
                  {formatCurrency(product.price)}
                  {hasDiscount && <span className="p-card-price-original">{formatCurrency(product.originalPrice)}</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
