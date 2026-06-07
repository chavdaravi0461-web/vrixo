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
    <section className="dc-section-tight anim-fade-up">
      <div className="dc-container">
        <div className="mb-6 flex items-end justify-between">
          <div className="flex items-center gap-3">
            {badge && (
              <span className="dc-badge-luxe">{badge}</span>
            )}
            {title && (
              <h2 className="dc-heading-md !text-[22px]">{title}</h2>
            )}
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[var(--dc-muted)] transition hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--dc-heading)]"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] text-[var(--dc-muted)] transition hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--dc-heading)]"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {link && (
              <Link href={link} className="ml-2 flex items-center gap-1 text-xs font-medium text-[var(--dc-muted)] hover:text-[var(--dc-heading)] transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          ref={rail}
          className="flex gap-3 overflow-x-auto px-[max(20px,calc((100vw-var(--dc-max))/2))] pb-2 scrollbar-none"
        >
          {products.map((p) => (
            <div key={p.id} className="w-[180px] shrink-0 sm:w-[200px] lg:w-[220px]">
              <ProductCardRail product={p} />
            </div>
          ))}
        </div>
      </div>
      <div className="dc-container mt-3 md:hidden">
        {link && (
          <Link href={link} className="flex items-center gap-1 text-xs font-medium text-[var(--dc-muted)] hover:text-[var(--dc-heading)]">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </section>
  );
}
