import { ProductCard } from "@/components/store/product-card";
import type { Product } from "@/types/index";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="p-grid anim-stagger">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} index={i} />
      ))}
    </div>
  );
}
