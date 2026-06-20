"use client";

import { useState } from "react";
import { ProductGrid } from "@/components/store/product-grid";
import type { Product } from "@/types/index";

const PAGE_SIZE = 12;

export function ProductGridPaginated({ products }: { products: Product[] }) {
  const [page, setPage] = useState(1);
  const shown = products.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < products.length;

  return (
    <div>
      <ProductGrid products={shown} />
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="hero-btn hero-btn-ghost btn-glow"
          >
            Show more ({products.length - shown.length})
          </button>
        </div>
      )}
    </div>
  );
}
