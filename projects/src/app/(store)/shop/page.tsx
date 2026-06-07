import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FiltersSidebar } from "@/components/store/filters-sidebar";
import { ProductGridPaginated } from "@/components/store/product-grid-paginated";
import { ShopListingControls } from "@/components/store/shop-listing-controls";
import { buildMetadata } from "@/lib/metadata";
import { getProducts } from "@/services/products";
import type { Product } from "@/types/index";

export const metadata = buildMetadata("Shop");

export default async function ShopPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const allProducts = await getProducts();
  const current = {
    category: getString(params.category),
    subcategory: getString(params.subcategory),
    search: getString(params.search),
    sort: getString(params.sort),
    brand: getString(params.brand),
    color: getString(params.color),
    size: getString(params.size),
    rating: getString(params.rating),
    availability: getString(params.availability),
    priceMin: getString(params.priceMin),
    priceMax: getString(params.priceMax),
    audience: getString(params.audience)
  };
  const products = await getProducts({
    category: current.category,
    subcategory: current.subcategory,
    search: current.search,
    priceMin: getNumber(params.priceMin),
    priceMax: getNumber(params.priceMax),
    brand: current.brand,
    color: current.color,
    size: current.size,
    rating: getNumber(params.rating),
    availability: current.availability === "in-stock" ? "in-stock" : undefined,
    sort: current.sort,
    audience: current.audience
  });
  const categoryChips = buildCategoryChips(allProducts);

  return (
    <section className="pb-12 pt-6">
      <div className="dc-container">
        <div className="dc-page-hero p-5 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--dc-muted)]">
            <Link href="/home" className="hover:text-[var(--dc-gold)]">Home</Link>
            <span>/</span>
            <span className="text-[var(--dc-heading)]">Shop</span>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">
                Vrixo catalog
              </p>
              <h1 className="mt-2 text-4xl font-black leading-tight text-[var(--dc-heading)] md:text-6xl">
                Premium shoes and watches
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--dc-muted)]">
                Browse polished footwear and watch styles with secure checkout, COD, and verified online payments.
              </p>
            </div>
            <div className="rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] bg-[var(--dc-bg-deep)] px-5 py-4 text-[var(--dc-heading)]">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--dc-gold)]">Showing</p>
              <p className="text-2xl font-bold">{products.length} products</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {categoryChips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                  chip.active(current)
                    ? "border-[var(--dc-gold)] bg-[var(--dc-gold)] text-black"
                    : "border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-muted)] hover:border-[var(--dc-gold)] hover:text-[var(--dc-heading)]"
                }`}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <ShopListingControls
            products={allProducts}
            current={current}
            productCount={products.length}
            totalCount={allProducts.length}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[290px_1fr]">
          <FiltersSidebar products={allProducts} current={current} className="hidden lg:block" />
          <div>
            {products.length > 0 ? (
              <ProductGridPaginated products={products} />
            ) : (
              <EmptyState
                title="No products found"
                description="Try adjusting filters, search terms, or category selection."
                ctaLabel="Browse all products"
                ctaHref="/shop"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNumber(value: string | string[] | undefined) {
  const parsed = Number(getString(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildCategoryChips(products: Product[]) {
  const subcategories = new Set(products.map((product) => product.subcategory.toLowerCase()));
  const chips = [
    {
      label: "All",
      href: "/shop",
      active: (current: Record<string, string | undefined>) => !current.category && !current.subcategory
    },
    {
      label: "Shoes",
      href: "/shop?category=shoes",
      active: (current: Record<string, string | undefined>) => current.category === "shoes" && !current.subcategory
    },
    {
      label: "Watches",
      href: "/shop?category=watches",
      active: (current: Record<string, string | undefined>) => current.category === "watches" && !current.subcategory
    },
    {
      label: "Men",
      href: "/shop?audience=men",
      active: (current: Record<string, string | undefined>) => current.audience === "men"
    },
    {
      label: "Women",
      href: "/shop?audience=women",
      active: (current: Record<string, string | undefined>) => current.audience === "women"
    }
  ];

  ["Sneakers", "Sandals", "Formal Shoes", "Casual Shoes", "Sports Shoes"].forEach((label) => {
    if (subcategories.has(label.toLowerCase())) {
      chips.push({
        label: label.replace(" Shoes", ""),
        href: `/shop?subcategory=${encodeURIComponent(label)}`,
        active: (current: Record<string, string | undefined>) => current.subcategory === label
      });
    }
  });

  return chips;
}
