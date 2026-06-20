"use client";

// ─── Skeleton System ───

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonText({ width = "100%", lines = 2 }: { width?: string; lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{ width: i === lines - 1 && lines > 1 ? "55%" : width, height: "12px" }}
        />
      ))}
    </div>
  );
}

export function SkeletonTitle() {
  return <Skeleton style={{ height: "20px", width: "60%" }} />;
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <Skeleton className="w-full" style={{ aspectRatio: "3/4" }} />
      <SkeletonTitle />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="p-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
