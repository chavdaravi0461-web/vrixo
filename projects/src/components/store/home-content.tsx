"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryShowcase } from "@/components/store/category-showcase";
import { BrandGrid } from "@/components/store/brand-grid";
import { Newsletter } from "@/components/store/newsletter";
import { ProductGrid } from "@/components/store/product-grid";
import { ProductRail } from "@/components/store/product-rail";
import { HeroSlider } from "@/components/store/hero-animated";
import { useRecentlyViewedStore } from "@/lib/store/recently-viewed-store";
import type { Product } from "@/types/index";

export function HomeContent({
  allProducts,
  featured,
  bestSellers,
  newArrivals,
}: {
  allProducts: Product[];
  featured: Product[];
  bestSellers: Product[];
  newArrivals: Product[];
}) {
  const watches = useMemo(() => allProducts.filter((p) => p.category?.toLowerCase() === "watches"), [allProducts]);

  const recentSlugs = useRecentlyViewedStore((s) => s.slugs);
  const recentlyViewed = useMemo(
    () => recentSlugs.map((slug) => allProducts.find((p) => p.slug === slug)).filter((p): p is Product => p !== undefined),
    [recentSlugs, allProducts]
  );

  return (
    <div>
      <HeroSlider products={allProducts} />

      <section className="dc-section-tight">
        <div className="dc-container">
          <div className="dc-stats-row anim-stagger-grid">
            {[
              { number: "15K+", label: "Happy Customers" },
              { number: "100+", label: "Premium Styles" },
              { number: "7 Days", label: "Easy Returns" },
              { number: "Free", label: "Shipping All India" },
            ].map((s) => (
              <div key={s.label} className="dc-stat-item anim-fade-up">
                <div className="dc-stat-number">{s.number}</div>
                <div className="dc-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dc-section-story">
        <div className="dc-container">
          <div className="dc-story-layout">
            <div className="dc-story-media anim-fade-up">
              <div className="w-full h-full bg-[var(--dc-surface)] flex items-center justify-center">
                {bestSellers[0] && (
                  <img
                    src={bestSellers[0].images?.[0] || "/placeholder.svg"}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="dc-story-media-accent" />
            </div>
            <div className="dc-story-content anim-fade-up">
              <span className="dc-eyebrow">Curated for you</span>
              <h2 className="dc-heading-lg">
                Every detail<br />speaks luxury
              </h2>
              <p className="dc-body-lg">
                From premium materials to precision craftsmanship — each piece is selected 
                for those who refuse to compromise on style.
              </p>
              <div>
                <Link href="/shop" className="dc-btn-luxe dc-btn-luxe-ghost inline-flex">
                  Explore the collection <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CategoryShowcase products={allProducts} />

      <section className="dc-section-cinematic">
        <div className="dc-container">
          <div className="mb-12 anim-fade-up">
            <span className="dc-eyebrow">Selection</span>
            <h2 className="dc-heading-lg">Best Sellers</h2>
          </div>
        </div>
        <ProductRail title="" products={bestSellers.length >= 8 ? bestSellers : allProducts.slice(0, 10)} />
        <div className="dc-container mt-10 text-center">
          <Link href="/shop?sort=popularity" className="dc-btn-luxe dc-btn-luxe-ghost inline-flex">
            View all best sellers <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <BrandGrid products={allProducts} />

      {newArrivals.length >= 4 && (
        <section className="dc-section-story">
          <div className="dc-container">
            <div className="dc-story-layout reversed">
              <div className="dc-story-media anim-fade-up">
                <div className="w-full h-full bg-[var(--dc-surface)] flex items-center justify-center">
                  {newArrivals[0] && (
                    <img
                      src={newArrivals[0].images?.[0] || "/placeholder.svg"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="dc-story-media-accent" />
              </div>
              <div className="dc-story-content anim-fade-up">
                <span className="dc-eyebrow">Fresh drops</span>
                <h2 className="dc-heading-lg">
                  New arrivals<br />every week
                </h2>
                <p className="dc-body-lg">
                  Stay ahead of the curve with our latest additions. Updated weekly with the 
                  most sought-after styles.
                </p>
                <div>
                  <Link href="/shop?sort=newest" className="dc-btn-luxe dc-btn-luxe-ghost inline-flex">
                    View new arrivals <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {recentlyViewed.length >= 2 ? (
        <ProductRail title="Recently Viewed" badge="Recent" products={recentlyViewed.slice(0, 10)} />
      ) : watches.length >= 4 ? (
        <ProductRail title="Premium Watches" badge="Collection" link="/category/watches" products={watches.slice(0, 10)} />
      ) : null}

      <section className="dc-section-tight">
        <div className="dc-container">
          <div className="dc-testimonial anim-fade-up">
            <blockquote>
              &ldquo;I was just browsing and ended up buying two pairs. The quality exceeded my expectations.&rdquo;
            </blockquote>
            <footer>— Verified Customer, Mumbai</footer>
          </div>
        </div>
      </section>

      <hr className="dc-divider-luxe" />

      <Newsletter />
    </div>
  );
}
