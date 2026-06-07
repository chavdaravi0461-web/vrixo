"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { easeEmphasized } from "@/lib/motion";
import type { Product } from "@/types/index";

const slides = [
  {
    subtitle: "Private edit - 2026",
    title: "Step Into Luxury",
    desc: "Premium shoes and watches selected for sharp silhouettes, confident detail, and instant ownership appeal.",
    cta: "Explore collection",
    link: "/shop",
  },
  {
    subtitle: "COD confidence - All India",
    title: "Wear Confidence",
    desc: "High-desire footwear delivered with easy payment, smooth support, and a polished buying experience.",
    cta: "Shop best sellers",
    link: "/shop?sort=popularity",
  },
  {
    subtitle: "Weekly drops",
    title: "New Arrivals",
    desc: "Fresh from the latest collections. Be the first to wear what is next.",
    cta: "View new arrivals",
    link: "/shop?sort=newest",
  },
];

export function HeroSlider({ products = [] }: { products?: Product[] }) {
  const [current, setCurrent] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setCurrent((p) => (p + 1) % slides.length), 5200);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const slide = slides[current];
  const product = products[current];
  const img = product ? normalizeProductImage(product.images?.[0]) ?? getFallbackProductImage() : null;
  const productTitle = product ? cleanProductTitle(product.title) : "Curated premium drop";

  return (
    <section className="dc-hero-cinema">
      <div className="dc-hero-cinema-bg">
        {img && (
          <motion.div
            key={`bg-${current}`}
            className="dc-hero-cinema-bg-image"
            initial={{ scale: 1.08, filter: "blur(8px)" }}
            animate={{ scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.6, ease: easeEmphasized }}
          >
            <Image src={img} alt="" fill priority className="object-cover" sizes="100vw" />
          </motion.div>
        )}
      </div>
      <div className="dc-hero-cinema-overlay" />

      <div className="dc-container">
        <div className="dc-hero-cinema-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${current}`}
              initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -24, filter: "blur(6px)" }}
              transition={{ duration: 0.7, ease: easeEmphasized }}
            >
              <span className="dc-hero-cinema-sub">{slide.subtitle}</span>
              <h1 className="dc-hero-cinema-title">{slide.title}</h1>
              <p className="dc-hero-cinema-desc">{slide.desc}</p>

              <div className="dc-hero-cinema-trust" aria-label="Store confidence highlights">
                <span>
                  <ShieldCheck /> Verified quality
                </span>
                <span>
                  <Truck /> Free COD
                </span>
                <span>
                  <Sparkles /> Weekly drops
                </span>
              </div>

              <div className="dc-hero-cinema-actions">
                <Link href={slide.link} className="dc-btn-luxe dc-btn-luxe-primary">
                  {slide.cta} <ArrowRight />
                </Link>
                <Link href="/shop" className="dc-btn-luxe dc-btn-luxe-ghost">
                  View all
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="dc-hero-cinema-visual">
        {img && (
          <motion.div
            key={`visual-${current}`}
            initial={{ scale: 1.1, opacity: 0, rotate: 1.5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 1.4, ease: easeEmphasized }}
            className="dc-hero-cinema-visual-image"
          >
            <Image src={img} alt={productTitle} fill priority className="object-cover object-center" sizes="55vw" />
          </motion.div>
        )}
        <div className="dc-hero-cinema-visual-overlay" />
        <AnimatePresence mode="wait">
          <motion.div
            key={`product-${current}`}
            className="dc-hero-product-plate"
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
            transition={{ duration: 0.7, ease: easeEmphasized }}
          >
            <span>Featured drop</span>
            <strong>{productTitle}</strong>
            {product && <em>{formatCurrency(product.price)}</em>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="dc-hero-progress" aria-label="Hero slides">
        {slides.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={index === current ? "active" : ""}
            onClick={() => setCurrent(index)}
            aria-label={`Show ${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}
