"use client";

import { useCartStore } from "@/lib/store/cart-store";

export function CartPageClient({
  children,
  empty
}: {
  children: React.ReactNode;
  empty: React.ReactNode;
}) {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="rounded-[2rem] bg-white p-10 text-center card-shadow">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Loading cart
        </p>
        <p className="mt-3 text-slate-600">Restoring your saved cart items.</p>
      </div>
    );
  }

  return items.length > 0 ? <>{children}</> : <>{empty}</>;
}
