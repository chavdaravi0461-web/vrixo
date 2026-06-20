import { ProductGridSkeleton } from "@/components/store/product-grid-skeleton";

export default function ShopLoading() {
  return (
    <section className="pb-12 pt-4" aria-busy="true" aria-label="Loading shop" role="status">
      <div className="container">
        <div className="glass-card p-5 md:p-7">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-4 h-10 w-72 max-w-full" />
          <div className="skeleton mt-3 h-4 w-full max-w-xl" />
        </div>
        <div className="mt-4">
          <ProductGridSkeleton />
        </div>
      </div>
    </section>
  );
}
