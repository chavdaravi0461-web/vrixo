import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FiltersSidebar } from "@/components/store/filters-sidebar";
import { ProductGridPaginated } from "@/components/store/product-grid-paginated";
import { ShopListingControls } from "@/components/store/shop-listing-controls";
import { buildMetadata } from "@/lib/metadata";
import { getProducts } from "@/services/products";
import type { Product } from "@/types/index";

export const metadata = buildMetadata("Shop");
export const revalidate = 300;

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
    <section className="section" style={{ paddingTop: "24px" }}>
      <div className="container">
        <div className="glass-card p-6 md:p-8 anim-fade-up">
          <div className="mb-4 flex items-center gap-2 body-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/home" className="hover:text-[var(--accent)]" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
            <span>/</span>
            <span style={{ color: "var(--text)" }}>Shop</span>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Vrixo catalog</p>
              <h1 className="display-xl" style={{ marginTop: "8px" }}>Premium shoes and watches</h1>
              <p className="body" style={{ marginTop: "8px", maxWidth: "480px" }}>
                Browse polished footwear and watch styles with secure checkout, COD, and verified online payments.
              </p>
            </div>
            <div className="glass-card" style={{ padding: "16px 20px", minWidth: "140px", textAlign: "center" }}>
              <p className="eyebrow">Showing</p>
              <p className="display-md" style={{ marginTop: "4px" }}>{products.length}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {categoryChips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium tracking-[0.06em] transition ${
                  chip.active(current)
                    ? "bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[rgba(255,255,255,.12)] hover:text-[var(--text)]"
                }`}
                style={{ textTransform: "uppercase", letterSpacing: ".06em", textDecoration: "none" }}
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

        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
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
    { label: "All", href: "/shop", active: (current: Record<string, string | undefined>) => !current.category && !current.subcategory && !current.audience },
    { label: "Men's Footwear", href: "/shop?category=shoes&audience=men", active: (current: Record<string, string | undefined>) => current.category === "shoes" && current.audience === "men" },
    { label: "Women's Footwear", href: "/shop?category=shoes&audience=women", active: (current: Record<string, string | undefined>) => current.category === "shoes" && current.audience === "women" },
    { label: "Watches", href: "/shop?category=watches", active: (current: Record<string, string | undefined>) => current.category === "watches" && !current.subcategory }
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
