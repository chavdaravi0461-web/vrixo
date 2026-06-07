import Link from "next/link";

export default function StoreNotFound() {
  return (
    <section className="dc-container py-16">
      <div className="dc-glass rounded-[var(--dc-radius-lg)] mx-auto max-w-xl p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">
          404
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--dc-heading)]">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--dc-muted)]">
          The page you requested does not exist or may have been moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/home" className="dc-btn dc-btn-primary">
            Go home
          </Link>
          <Link href="/shop" className="dc-btn dc-btn-outline">
            Browse products
          </Link>
        </div>
      </div>
    </section>
  );
}
