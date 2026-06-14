"use client";

import Image from "next/image";
import Link from "next/link";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";

const brandList = [
  "Tisot", "Adidas", "Puma", "Skechers",
  "New Balance", "Nike", "Asics", "Crocs",
];

export function BrandGrid({ products = [] }: { products?: Product[] }) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header anim-fade-up">
          <span className="section-eyebrow">Brands</span>
          <h2 className="section-title">Explore our brands</h2>
        </div>
        <div className="brand-grid anim-stagger">
          {brandList.map((brand, i) => {
            const product = products.find((p) => p.brand?.toLowerCase().includes(brand.toLowerCase()));
            const img = product ? normalizeProductImage(product.images?.[0]) ?? getFallbackProductImage() : getFallbackProductImage();
            return (
              <div key={brand} className="anim-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <Link href={`/shop?brand=${brand.replace(/\s+/g, "+")}`} className="brand-card block">
                  <Image src={img} alt={brand} width={400} height={400} className="w-full h-full object-cover" />
                  <span className="brand-card-name">{brand}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
