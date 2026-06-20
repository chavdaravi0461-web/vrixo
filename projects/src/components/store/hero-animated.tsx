"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { easeEmphasized } from "@/lib/motion";
import type { Product } from "@/types/index";

const slides = [
  {
    subtitle: "Signature curation",
    title: ["Step Into", "Luxury"],
    desc: "Premium shoes and watches selected for sharp silhouettes, confident detail, and instant ownership appeal.",
    cta: "Explore collection",
    link: "/shop",
  },
  {
    subtitle: "COD confidence - All India",
    title: ["Wear", "Confidence"],
    desc: "High-desire footwear delivered with easy payment, smooth support, and a polished buying experience.",
    cta: "Shop best sellers",
    link: "/shop?sort=popularity",
  },
  {
    subtitle: "Weekly drops",
    title: ["New", "Arrivals"],
    desc: "Fresh from the latest collections. Be the first to wear what is next.",
    cta: "View new arrivals",
    link: "/shop?sort=newest",
  },
];

export function HeroSlider({ products = [] }: { products?: Product[] }) {
  const [current, setCurrent] = useState(0);
  const reduceMotion = useReducedMotion();

  const productCount = products.length;

  useEffect(() => {
    if (reduceMotion || productCount === 0) return;
    const timer = setInterval(() => setCurrent((p) => (p + 1) % productCount), 5200);
    return () => clearInterval(timer);
  }, [reduceMotion, productCount]);

  if (productCount === 0) {
    return (
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-eyebrow"><span className="hero-dot" />Signature curation</div>
            <h1 className="hero-title display display-2xl">
              <span className="hero-title-line">Step Into</span>
              <span className="hero-title-line hero-title-accent">Luxury</span>
            </h1>
            <p className="hero-desc">Premium shoes and watches selected for sharp silhouettes, confident detail, and instant ownership appeal.</p>
            <div className="hero-actions">
              <Link href="/shop" className="hero-btn hero-btn-primary">Explore collection <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/shop" className="hero-btn hero-btn-ghost">View all</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[current % slides.length];
  const product = products[current % productCount];
  const heroImageIndex = product?.highlighted && product.specifications?.heroImageIndex
    ? Number(product.specifications.heroImageIndex)
    : 0;
  const img = product
    ? normalizeProductImage(product.images?.[Math.min(heroImageIndex, product.images.length - 1)]) ?? getFallbackProductImage()
    : null;

  return (
    <section className="hero">
      <div className="bg-ambient" style={{ zIndex: 1 }}>
        {img && (
          <motion.div
            key={`bg-${current}`}
            className="bg-ambient-blob"
            style={{ width: "100%", height: "100%", top: 0, left: 0, filter: "blur(80px)", opacity: 0.06 }}
            initial={{ scale: 1.08, filter: "blur(80px)" }}
            animate={{ scale: 1, filter: "blur(80px)" }}
            transition={{ duration: 1.6, ease: easeEmphasized }}
          >
            <Image src={img} alt="" fill priority className="object-cover" sizes="100vw" />
          </motion.div>
        )}
      </div>

      <div className="hero-inner">
        <div className="hero-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${current}`}
              initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
              transition={{ duration: 0.6, ease: easeEmphasized }}
            >
              <div className="hero-eyebrow">
                <span className="hero-dot" />
                {slide.subtitle}
              </div>

              <h1 className="hero-title display display-2xl">
                {slide.title.map((line, i) => (
                  <span key={i} className={`hero-title-line ${i === slide.title.length - 1 ? "hero-title-accent" : ""}`}>
                    {line}
                  </span>
                ))}
              </h1>

              <p className="hero-desc">{slide.desc}</p>

              <div className="hero-actions">
                <Link href={slide.link} className="hero-btn hero-btn-primary btn-glow">
                  {slide.cta} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/shop" className="hero-btn hero-btn-ghost">
                  View all
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hero-image-panel">
          {product && img && (
            <motion.div
              key={`product-${current}`}
              className={`hero-image-frame${product.highlighted ? " hero-image-frame-highlight" : ""}`}
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.7, ease: easeEmphasized }}
            >
              {product.highlighted && <div className="hero-image-glow" />}
              <Image src={img} alt={product.title} fill sizes="(max-width: 1024px) 90vw, 480px" priority />
              <div className="hero-image-badge">
                {cleanProductTitle(product.title)}
                {product.highlighted && <span className="hero-image-badge-dot" />}
                <span className="hero-image-badge-price">{formatCurrency(product.price)}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="hero-metrics" role="list" aria-label="Store statistics">
        {[
          { value: "15K+", label: "Happy Customers" },
          { value: "100+", label: "Premium Styles" },
          { value: "7 Days", label: "Easy Returns" },
          { value: "Free", label: "Shipping All India" },
        ].map((m) => (
          <div key={m.label} className="hero-metric anim-fade-up" role="listitem">
            <div className="hero-metric-value">{m.value}</div>
            <div className="hero-metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10" role="tablist" aria-label="Product slides">
        {products.slice(0, Math.min(productCount, 5)).map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="group relative"
            onClick={() => setCurrent(index)}
            role="tab"
            aria-selected={index === current % productCount}
            aria-label={`Show product ${index + 1}: ${cleanProductTitle(item.title)}`}
          >
            <div className={`h-[2px] rounded-full transition-all duration-300 ${index === current % productCount ? "w-[48px] bg-[var(--accent)]" : "w-[40px] bg-[var(--border)]"}`} />
            {index === current % productCount && (
              <div className="absolute inset-0 h-[2px] rounded-full bg-[var(--accent)] origin-left" style={{ animation: "progress-fill 5.2s linear" }} />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
