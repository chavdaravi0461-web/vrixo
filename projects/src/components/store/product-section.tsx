"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductGrid } from "@/components/store/product-grid";
import type { Product } from "@/types/index";

export function ProductSection({
  eyebrow,
  title,
  description,
  products
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
}) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header anim-fade-up">
          {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-subtitle">{description}</p>}
        </div>
        <ProductGrid products={products} />
        <div className="mt-8 text-center anim-fade-up">
          <Link href="/shop" className="hero-btn hero-btn-ghost inline-flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
