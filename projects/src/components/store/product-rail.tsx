"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCardRail } from "@/components/store/product-card-rail";
import type { Product } from "@/types/index";

export function ProductRail({
  title,
  link,
  products,
  badge,
}: {
  title: string;
  link?: string;
  products: Product[];
  badge?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!rail.current) return;
    const d = rail.current.clientWidth * 0.6;
    rail.current.scrollBy({ left: dir === "left" ? -d : d, behavior: "smooth" });
  }

  if (!products.length) return null;

  return (
    <section className="section anim-fade-up" style={{ padding: "60px 0" }}>
      <div className="container">
        <div className="mb-6 flex items-end justify-between">
          <div className="flex items-center gap-3">
            {badge && (
              <span className="mono" style={{ padding: "3px 10px", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)" }}>{badge}</span>
            )}
            {title && (
              <h2 className="display-md" style={{ margin: 0 }}>{title}</h2>
            )}
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <button type="button" onClick={() => scroll("left")} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition hover:border-[rgba(255,255,255,.12)] hover:text-[var(--text)]" aria-label="Scroll left">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scroll("right")} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition hover:border-[rgba(255,255,255,.12)] hover:text-[var(--text)]" aria-label="Scroll right">
              <ChevronRight className="h-4 w-4" />
            </button>
            {link && (
              <Link href={link} className="ml-2 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="relative">
        <div ref={rail} className="rail" style={{ paddingBottom: "8px" }}>
          {products.map((p) => (
            <div key={p.id} className="rail-item">
              <ProductCardRail product={p} />
            </div>
          ))}
        </div>
      </div>
      <div className="container mt-3 md:hidden">
        {link && (
          <Link href={link} className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </section>
  );
}
