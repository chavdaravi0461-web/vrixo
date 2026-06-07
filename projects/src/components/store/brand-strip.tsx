"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef } from "react";

const brands = [
  "Nike", "New Balance", "Adidas", "Puma", "Jordan", "Crocs",
  "Reebok", "Hoka", "Tissot", "Tommy Hilfiger", "Patek Phillips", "On",
];

export function BrandStrip() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: number) {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  return (
    <section className="dc-brand-strip">
      <div className="dc-container">
        <h2 className="dc-brand-strip-title">BRANDS WE OFFER</h2>
        <div className="relative">
          <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm border border-[var(--dc-border)] hover:bg-[var(--dc-surface-hover)]" aria-label="Previous">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div ref={scrollRef} className="dc-brand-scroll">
            {brands.map((brand) => (
              <a key={brand} href={`/shop?brand=${encodeURIComponent(brand)}`} className="dc-brand-item">
                <div className="dc-brand-logo-wrap">
                  <span className="text-xs font-bold text-[var(--dc-heading)]">{brand.charAt(0)}</span>
                </div>
                <span>{brand}</span>
              </a>
            ))}
          </div>
          <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm border border-[var(--dc-border)] hover:bg-[var(--dc-surface-hover)]" aria-label="Next">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
