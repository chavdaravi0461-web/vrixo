"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
    <section className="dc-section">
      <div className="dc-container">
        <div className="mb-5 text-center">
          {eyebrow && <span className="inline-block rounded bg-[var(--dc-blue)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white mb-2">{eyebrow}</span>}
          <h2 className="text-xl font-bold text-[var(--dc-heading)]" style={{ fontFamily: "var(--dc-font-heading)" }}>{title}</h2>
          {description && <p className="text-sm text-[var(--dc-muted)] mt-1">{description}</p>}
        </div>
        <ProductGrid products={products} />
        <div className="mt-4 text-center">
          <Link href="/shop" className="dc-btn dc-btn-primary">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
