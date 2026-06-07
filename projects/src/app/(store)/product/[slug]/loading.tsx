export default function ProductLoading() {
  return (
    <>
      <section className="dc-container mt-6">
        <div className="dc-glass dc-glass-edge grid gap-5 p-4 lg:grid-cols-[1fr_0.95fr] lg:p-6">
          {/* Gallery Skeleton */}
          <div>
            <div className="aspect-square animate-pulse rounded-lg bg-[var(--dc-border)]" />
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 w-16 animate-pulse rounded bg-[var(--dc-border)]"
                />
              ))}
            </div>
          </div>

          {/* Details Skeleton */}
          <div className="p-2">
            <div className="h-3 w-24 animate-pulse bg-[var(--dc-border)]" />
            <div className="mt-2 h-10 w-64 max-w-full animate-pulse bg-[var(--dc-surface-strong)]" />
            
            {/* Rating Skeleton */}
            <div className="mt-3 flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--dc-border)]" />
              <div className="h-4 w-24 animate-pulse bg-[var(--dc-border)]" />
            </div>

            {/* Price Skeleton */}
            <div className="mt-5 flex gap-3">
              <div className="h-10 w-32 animate-pulse bg-[var(--dc-surface-strong)]" />
              <div className="h-8 w-24 animate-pulse bg-[var(--dc-border)]" />
            </div>

            {/* Description Skeleton */}
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse bg-[var(--dc-border)]" />
              <div className="h-3 w-full animate-pulse bg-[var(--dc-border)]" />
              <div className="h-3 w-2/3 animate-pulse bg-[var(--dc-border)]" />
            </div>

            {/* Info Chips Skeleton */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-[var(--dc-border)]" />
              ))}
            </div>

            {/* Button Skeleton */}
            <div className="mt-5 h-12 animate-pulse rounded-lg bg-[var(--dc-surface-strong)]" />

            {/* Accordions Skeleton */}
            <div className="mt-8 border-t border-[var(--dc-border)] pt-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-[var(--dc-border)]">
                  <div className="h-4 w-32 animate-pulse bg-[var(--dc-border)]" />
                  <div className="h-4 w-4 animate-pulse bg-[var(--dc-border)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Related Products Skeleton */}
      <section className="dc-container mt-16">
        <div className="mb-8">
          <div className="h-3 w-32 animate-pulse bg-[var(--dc-border)]" />
          <div className="mt-2 h-8 w-48 animate-pulse bg-[var(--dc-surface-strong)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square animate-pulse rounded-lg bg-[var(--dc-border)]" />
              <div className="h-4 w-full animate-pulse bg-[var(--dc-border)]" />
              <div className="h-3 w-3/4 animate-pulse bg-[var(--dc-border)]" />
              <div className="h-6 w-16 animate-pulse rounded bg-[var(--dc-border)]" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
