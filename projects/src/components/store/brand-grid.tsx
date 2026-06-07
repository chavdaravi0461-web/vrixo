"use client";

import Image from "next/image";
import Link from "next/link";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";

const brandList = [
  "Tisot",
  "Adidas",
  "Puma",
  "Skechers",
  "New Balance",
  "Nike",
  "Asics",
  "Crocs",
];

export function BrandGrid({ products = [] }: { products?: Product[] }) {
  return (
    <section className="dc-section-tight">
      <div className="dc-container">
        <h2 className="dc-heading-md text-center anim-fade-up">
          Explore Our Brands
        </h2>
        <div className="dc-brand-grid anim-stagger-grid">
          {brandList.map((brand, i) => {
            const product = products.find((p) => p.brand?.toLowerCase().includes(brand.toLowerCase()));
            const img = product ? normalizeProductImage(product.images?.[0]) ?? getFallbackProductImage() : getFallbackProductImage();
            return (
              <div key={brand} className="anim-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <Link href={`/shop?brand=${brand.replace(/\s+/g, "+")}`} className="dc-brand-grid-card">
                  <Image src={img} alt={brand} width={400} height={400} />
                  <span className="brand-name">{brand}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
