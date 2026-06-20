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
  const heroProducts = useMemo(() => allProducts.filter((p) => p.highlighted), [allProducts]);
  const watches = useMemo(() => allProducts.filter((p) => p.category?.toLowerCase() === "watches"), [allProducts]);

  const recentSlugs = useRecentlyViewedStore((s) => s.slugs);
  const recentlyViewed = useMemo(
    () => recentSlugs.map((slug) => allProducts.find((p) => p.slug === slug)).filter((p): p is Product => p !== undefined),
    [recentSlugs, allProducts]
  );

  return (
    <div>
      <HeroSlider products={heroProducts.length > 0 ? heroProducts : allProducts} />

      <section className="section">
        <div className="container">
          <div className="section-header anim-fade-up">
            <span className="section-eyebrow">Selection</span>
            <h2 className="section-title">Best Sellers</h2>
          </div>
        </div>
        <ProductRail title="" products={bestSellers.length >= 8 ? bestSellers : allProducts.slice(0, 10)} />
        <div className="container mt-10 text-center anim-fade-up">
          <Link href="/shop?sort=popularity" className="hero-btn hero-btn-ghost inline-flex">
            View all best sellers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {featured.length >= 4 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-header anim-fade-up">
              <span className="section-eyebrow">Editors&apos; pick</span>
              <h2 className="section-title">Featured Collection</h2>
              <p className="section-subtitle">Handpicked premium pieces selected by our curation team.</p>
            </div>
          </div>
          <ProductGrid products={featured.slice(0, 8)} />
          <div className="container mt-10 text-center anim-fade-up">
            <Link href="/shop?sort=popularity" className="hero-btn hero-btn-ghost inline-flex">
              View all featured <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-header anim-fade-up">
            <span className="section-eyebrow">Curated for you</span>
            <h2 className="section-title">Every detail speaks luxury</h2>
            <p className="section-subtitle">
              From premium materials to precision craftsmanship, each piece is selected for those who refuse to compromise on style.
            </p>
          </div>
          <div className="text-center anim-fade-up">
            <Link href="/shop" className="hero-btn hero-btn-ghost inline-flex">
              Explore the collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CategoryShowcase products={allProducts} />

      <BrandGrid products={allProducts} />

      {newArrivals.length >= 4 && (
        <section className="section">
          <div className="container">
            <div className="section-header anim-fade-up">
              <span className="section-eyebrow">Fresh drops</span>
              <h2 className="section-title">New arrivals every week</h2>
              <p className="section-subtitle">
                Stay ahead of the curve with our latest additions. Updated weekly with the most sought-after styles.
              </p>
            </div>
          </div>
          <ProductGrid products={newArrivals.slice(0, 8)} />
          <div className="container mt-10 text-center anim-fade-up">
            <Link href="/shop?sort=newest" className="hero-btn hero-btn-ghost inline-flex">
              View new arrivals <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {recentlyViewed.length >= 2 ? (
        <ProductRail title="Recently Viewed" badge="Recent" products={recentlyViewed.slice(0, 10)} />
      ) : watches.length >= 4 ? (
        <ProductRail title="Premium Watches" badge="Collection" link="/category/watches" products={watches.slice(0, 10)} />
      ) : null}

      <section className="section" style={{ padding: "60px 0" }}>
        <div className="container">
          <div className="section-header anim-fade-up">
            <blockquote className="display-md" style={{ fontStyle: "italic", fontWeight: 400, maxWidth: "600px", margin: "0 auto", color: "var(--text-secondary)" }}>
              &ldquo;I was just browsing and ended up buying two pairs. The quality exceeded my expectations.&rdquo;
            </blockquote>
            <footer className="body-sm" style={{ marginTop: "12px" }}>- Verified Customer, Mumbai</footer>
          </div>
        </div>
      </section>

      <Newsletter />
    </div>
  );
}
