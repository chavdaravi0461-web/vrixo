import { ProductGridSkeleton } from "@/components/store/product-grid-skeleton";

export default function ShopLoading() {
  return (
    <section className="bg-[var(--dc-cream)] pb-12 pt-4">
      <div className="container">
        <div className="border border-[var(--dc-border)] bg-white p-5 shadow-sm md:p-7">
          <div className="h-3 w-32 animate-pulse bg-[var(--dc-border)]" />
          <div className="mt-4 h-10 w-72 max-w-full animate-pulse bg-[var(--dc-border-dark)]" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse bg-[var(--dc-border)]" />
        </div>
        <div className="mt-4">
          <ProductGridSkeleton />
        </div>
      </div>
    </section>
  );
}
