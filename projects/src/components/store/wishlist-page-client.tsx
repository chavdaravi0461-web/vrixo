"use client";

import { useMemo } from "react";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState } from "@/components/empty-state";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import type { Product } from "@/types/index";

export function WishlistPageClient({ products }: { products: Product[] }) {
  const ids = useWishlistStore((state) => state.ids);
  const wishedProducts = useMemo(
    () => products.filter((product) => ids.includes(product.id)),
    [ids, products]
  );

  return wishedProducts.length > 0 ? (
    <ProductGrid products={wishedProducts} />
  ) : (
    <EmptyState
      title="Wishlist is empty"
      description="Save products you like and come back anytime."
      ctaLabel="Discover products"
      ctaHref="/shop"
    />
  );
}
