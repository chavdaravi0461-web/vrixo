export default function ProductLoading() {
  return (
    <div aria-busy="true" aria-label="Loading product" role="status">
      <section className="container mt-6">
        <div className="glass-card grid gap-5 p-4 lg:grid-cols-[1fr_0.95fr] lg:p-6">
          {/* Gallery Skeleton */}
          <div>
            <div className="skeleton aspect-square rounded-lg" />
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skeleton h-16 w-16 rounded"
                />
              ))}
            </div>
          </div>

          {/* Details Skeleton */}
          <div className="p-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-2 h-10 w-64 max-w-full" />
            
            {/* Rating Skeleton */}
            <div className="mt-3 flex gap-2">
              <div className="skeleton h-8 w-20 rounded-full" />
              <div className="skeleton h-4 w-24" />
            </div>

            {/* Price Skeleton */}
            <div className="mt-5 flex gap-3">
              <div className="skeleton h-10 w-32" />
              <div className="skeleton h-8 w-24" />
            </div>

            {/* Description Skeleton */}
            <div className="mt-3 space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-2/3" />
            </div>

            {/* Info Chips Skeleton */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
            </div>

            {/* Button Skeleton */}
            <div className="skeleton mt-5 h-12 rounded-lg" />

            {/* Accordions Skeleton */}
            <div className="mt-8 border-t border-[var(--border)] pt-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-[var(--border)]">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-4 w-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Related Products Skeleton */}
      <section className="container mt-16">
        <div className="mb-8">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-2 h-8 w-48" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="skeleton aspect-square rounded-lg" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-6 w-16 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
