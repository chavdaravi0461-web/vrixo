export default function AdminLoading() {
  return (
    <div className="admin-page">
      <div className="admin-shell grid min-h-screen lg:grid-cols-[292px_1fr]">
        <aside className="admin-sidebar hidden p-6 lg:block">
          <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
          <div className="mt-6 grid gap-2">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        </aside>
        <main className="min-w-0 p-4 md:p-8 xl:p-10">
          <div className="admin-hero h-48 animate-pulse" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="admin-kpi h-32 animate-pulse" />
            ))}
          </div>
          <div className="mt-6 grid gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="admin-card h-28 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
