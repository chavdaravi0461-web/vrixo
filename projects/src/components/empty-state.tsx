import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="border border-dashed border-[var(--dc-border-dark)] bg-white/90 p-10 text-center shadow-sm">
      <h2 className="text-2xl font-black uppercase tracking-[0.04em] text-[var(--dc-black)]">{title}</h2>
      <p className="mt-3 text-[var(--dc-muted)]">{description}</p>
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="mt-6 inline-block">
          <Button>{ctaLabel}</Button>
        </Link>
      ) : null}
    </div>
  );
}
