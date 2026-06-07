"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";
import { productMatchesAudience } from "@/lib/product-audience";

export function CategoryShowcase({ products = [] }: { products?: Product[] }) {
  const cats = [
    {
      label: "Men's", title: "Sport shoes",
      href: "/shop?category=shoes",
      img: products.find((p) => p.category?.toLowerCase() === "shoes" && productMatchesAudience(p, "men")),
    },
    {
      label: "Unisex", title: "Slides & Crocs",
      href: "/shop?category=shoes&subcategory=slides",
      img: products.find((p) => p.category?.toLowerCase() === "shoes" && p.subcategory?.toLowerCase() === "slides"),
    },
    {
      label: "Trending", title: "Sneakers",
      href: "/shop?category=shoes&subcategory=sports-shoes",
      img: products.find((p) => p.category?.toLowerCase() === "shoes" && p.subcategory?.toLowerCase() === "sports shoes"),
    },
    {
      label: "Premium", title: "Watches",
      href: "/category/watches",
      img: products.find((p) => p.category?.toLowerCase() === "watches"),
    },
  ];

  return (
    <section className="dc-section-tight">
      <div className="dc-container">
        <div className="mb-10 text-center anim-fade-up">
          <span className="dc-eyebrow">Collections</span>
          <h2 className="dc-heading-md">Browse by category</h2>
        </div>
        <div className="dc-category-grid anim-stagger-grid">
          {cats.map((cat, i) => {
            const img = cat.img ? normalizeProductImage(cat.img.images?.[0]) ?? getFallbackProductImage() : getFallbackProductImage();
            return (
              <div key={i} className="anim-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <Link href={cat.href} className="dc-category-card">
                  <Image src={img} alt={cat.title} width={400} height={400} className="w-full" />
                  <div className="dc-category-card-body">
                    <p className="cat-label">{cat.label}</p>
                    <p className="cat-title">{cat.title}</p>
                    <span className="cat-link">Shop now <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
