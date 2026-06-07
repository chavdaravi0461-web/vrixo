"use client";

// ─── Skeleton System ───

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`dc-skeleton ${className}`} style={style} />;
}

export function SkeletonText({ width = "100%", lines = 2 }: { width?: string; lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="dc-skeleton-text"
          style={{ width: i === lines - 1 && lines > 1 ? "55%" : width }}
        />
      ))}
    </div>
  );
}

export function SkeletonTitle() {
  return <Skeleton className="dc-skeleton-title" />;
}

export function SkeletonCard() {
  return (
    <div className="dc-card-shadow flex flex-col gap-3 rounded-[26px] border border-white/[0.06] bg-white/[0.03] p-4">
      <Skeleton className="dc-skeleton-image w-full" />
      <SkeletonTitle />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="dc-product-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Cinematic Preloader ───

export function CinematicPreloader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050506]">
      <div className="relative mb-8">
        <div className="h-14 w-14 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
          <svg className="h-7 w-7 text-[#efc978] animate-pulse" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-transparent via-[#efc978]/20 to-transparent blur-xl animate-pulse" />
      </div>
      <div className="relative">
        <div className="flex gap-[3px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#efc978] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1.2s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lazy Section wrapper ───

export function LazySection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`dc-section ${className}`} style={{ contentVisibility: "auto" as unknown as React.CSSProperties["contentVisibility"] }}>
      {children}
    </section>
  );
}
