import { EmptyState } from "@/components/empty-state";
import { ProductGrid } from "@/components/store/product-grid";
import { buildMetadata } from "@/lib/metadata";
import { getProducts } from "@/services/products";

export const metadata = buildMetadata("Search");

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const products = await getProducts({ search: query });

  return (
    <section className="pb-12 pt-6">
      <div className="dc-container">
      <div className="dc-page-hero p-5 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a5a24]">Search results</p>
        <h1 className="mt-2 text-4xl font-black leading-tight text-[#181510] md:text-6xl">
          Results for &quot;{query ?? ""}&quot;
        </h1>
        <p className="mt-2 text-sm text-[#6b6256]">{products.length} products matched your search.</p>
      </div>
      <div className="mt-5">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState
            title="No matching products"
            description="Try broader keywords like running, chronograph, leather, or smart watch."
            ctaLabel="Back to shop"
            ctaHref="/shop"
          />
        )}
      </div>
      </div>
    </section>
  );
}
