export default function AdminLoading() {
  return (
    <div className="os-page">
      <div className="grid min-h-screen" style={{ gridTemplateColumns: "220px 1fr" }}>
        <aside className="hidden lg:block" style={{ borderRight: "1px solid var(--os-border)" }}>
          <div className="space-y-3 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="os-skeleton" style={{ height: "28px" }} />
            ))}
          </div>
        </aside>
        <main className="min-w-0 p-4 md:p-6 xl:p-8">
          <div className="os-skeleton" style={{ height: "150px", borderRadius: "var(--os-radius-xl)" }} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="os-skeleton" style={{ height: "112px" }} />
            ))}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="os-skeleton" style={{ height: "240px" }} />
            ))}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="os-skeleton" style={{ height: "280px" }} />
            <div className="flex flex-col gap-5">
              <div className="os-skeleton" style={{ height: "280px" }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
