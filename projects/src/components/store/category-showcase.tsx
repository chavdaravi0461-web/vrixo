import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { productMatchesAudience } from "@/lib/product-audience";
import type { Product } from "@/types/index";

const categories = [
  {
    href: "/category/mens-shoes",
    title: "Men's Shoes",
    description: "Sharp everyday pairs for work, weekends, and clean street styling.",
    matcher: (product: Product) => product.category.toLowerCase() === "shoes" && productMatchesAudience(product, "men")
  },
  {
    href: "/category/womens-shoes",
    title: "Women's Shoes",
    description: "Elegant silhouettes with premium comfort and polished finish.",
    matcher: (product: Product) => product.category.toLowerCase() === "shoes" && productMatchesAudience(product, "women")
  },
  {
    href: "/category/watches",
    title: "Premium Watches",
    description: "Modern wristwear for refined daily confidence.",
    matcher: (product: Product) => product.category.toLowerCase() === "watches"
  },
  {
    href: "/shop?sort=newest",
    title: "New Arrivals",
    description: "Fresh additions selected for immediate wardrobe impact.",
    matcher: (product: Product) => product.newArrival
  },
  {
    href: "/shop?sort=popularity",
    title: "Best Sellers",
    description: "Customer favorites with strong value and dependable style.",
    matcher: (product: Product) => product.bestseller
  },
  {
    href: "/shop",
    title: "Everyday Essentials",
    description: "Shoes and watches that work across your regular rotation.",
    matcher: () => true
  }
];

export function CategoryShowcase({ products = [] }: { products?: Product[] }) {
  const usedProductIds = new Set<string>();

  return (
    <section className="dc-section">
      <div className="dc-container">
        <div className="mb-7">
          <span className="dc-badge">Shop by category</span>
          <h2 className="dc-section-title mt-4">Curated ways to discover</h2>
          <p className="dc-section-subtitle">
            Faster paths into the catalog for shoppers who know what they want and shoppers still comparing.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const product = products.find((entry) => {
              if (usedProductIds.has(entry.id)) return false;
              return category.matcher(entry);
            });
            if (product) usedProductIds.add(product.id);
            const image = normalizeProductImage(product?.images[0]) ?? getFallbackProductImage();

            return (
              <Link
                key={category.title}
                href={category.href}
                className="dc-soft-panel dc-lift group overflow-hidden"
              >
                <div className="relative aspect-[1.25] bg-[var(--dc-cream)]">
                  <Image
                    src={image}
                    alt={category.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-contain p-8 transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-4 top-4 rounded-full bg-white/88 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dc-gold-dark)]">
                    Vrixo edit
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-2xl font-black text-[var(--dc-black)]">{category.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--dc-muted)]">{category.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--dc-gold-dark)]">
                    Shop now <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
