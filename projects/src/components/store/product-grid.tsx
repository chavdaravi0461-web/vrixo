import { ProductCard, type ProductCardSummary } from "@/components/store/product-card";
import type { Product } from "@/types/index";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="dc-product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={toProductCardSummary(product)} />
      ))}
    </div>
  );
}

function toProductCardSummary(product: Product): ProductCardSummary {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    category: product.category,
    subcategory: product.subcategory,
    brand: product.brand,
    price: product.price,
    originalPrice: product.originalPrice,
    discountPercent: product.discountPercent,
    stock: product.stock,
    selectedSize: product.sizes[0],
    selectedColor: product.colors[0],
    image: product.images[0],
    featured: product.featured,
    bestseller: product.bestseller,
    newArrival: product.newArrival,
    rating: product.rating
  };
}
