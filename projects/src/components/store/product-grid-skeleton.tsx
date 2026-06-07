export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="dc-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--dc-radius-sm)] border border-[var(--dc-border)] bg-[var(--dc-surface)]"
          style={i < 4 ? { animationDelay: `${i * 0.05}s` } : undefined}
        >
          <div className="lp-skeleton aspect-[4/5]" />
          <div className="space-y-2.5 p-4">
            <div className="lp-skeleton h-3 w-16 rounded" />
            <div className="lp-skeleton h-4 w-3/4 rounded" />
            <div className="lp-skeleton h-4 w-1/3 rounded" />
            <div className="lp-skeleton h-10 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
