"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function StoreError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[store.error]", error);
  }, [error]);

  return (
    <section className="dc-container py-16">
      <div className="dc-glass rounded-[var(--dc-radius-lg)] mx-auto max-w-xl p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">
          Something went wrong
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--dc-heading)]">We hit a routing issue</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--dc-muted)]">
          The page could not load safely. You can retry or continue shopping without losing your cart.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign("/home")}>
            Go to home
          </Button>
        </div>
      </div>
    </section>
  );
}
