export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden border border-[var(--dc-border)] bg-white shadow-sm"
        >
          <div className="aspect-[0.82] animate-pulse bg-[var(--dc-cream-dark)]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-24 animate-pulse bg-[var(--dc-border)]" />
            <div className="h-4 w-full animate-pulse bg-[var(--dc-border)]" />
            <div className="h-4 w-2/3 animate-pulse bg-[var(--dc-border)]" />
            <div className="h-5 w-28 animate-pulse bg-[var(--dc-border-dark)]" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="h-9 animate-pulse bg-[var(--dc-black)]/10" />
              <div className="h-9 animate-pulse bg-[var(--dc-border)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
