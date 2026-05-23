import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  Headphones,
  MessageCircle,
  PackageCheck,
  Quote,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck
} from "lucide-react";
import { CategoryShowcase } from "@/components/store/category-showcase";
import { Newsletter } from "@/components/store/newsletter";
import { ProductGrid } from "@/components/store/product-grid";
import { ProductSection } from "@/components/store/product-section";
import { buildMetadata } from "@/lib/metadata";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import {
  getBestSellerProducts,
  getFeaturedProducts,
  getNewArrivalProducts,
  getProducts
} from "@/services/products";
import type { Product } from "@/types/index";

export const metadata = buildMetadata(
  "Premium Shoes & Watches",
  "Shop Vrixo premium shoes and timeless watches with COD, secure online payment, easy returns, and genuine products."
);

export default async function HomePage() {
  const [allProducts, featured, bestSellers, newArrivals] = await Promise.all([
    getProducts(),
    getFeaturedProducts(),
    getBestSellerProducts(),
    getNewArrivalProducts()
  ]);

  return (
    <>
      <Hero products={allProducts} />
      <CategoryShowcase products={allProducts} />
      <BrandManifesto />
      <TrustSection />
      <section className="dc-section">
        <div className="dc-container">
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="dc-badge">Luxury edit</span>
              <h2 className="dc-section-title mt-4">Shop the Vrixo selection</h2>
              <p className="dc-section-subtitle">
                Polished footwear and watch styles with clear pricing, quick cart actions, COD, and secure online payment.
              </p>
            </div>
            <Link href="/shop" className="dc-btn-secondary self-start md:self-auto">
              View all products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductGrid products={allProducts.slice(0, 8)} />
        </div>
      </section>
      <ProductSection
        eyebrow="Featured"
        title="Best of Shoes and Watches"
        description="Customer-ready picks selected for premium everyday style and confident checkout."
        products={featured}
      />
      <ProductSection
        eyebrow="Top Rated"
        title="Popular Picks"
        description="High-value products for shoppers who want sharp style and dependable daily use."
        products={bestSellers}
      />
      <ProductSection
        eyebrow="Fresh Arrivals"
        title="New Drops"
        description="Latest shoes and watches added to Vrixo, ready to order today."
        products={newArrivals}
      />
      <FounderStory />
      <SocialProofSection />
      <ViralStyleSection />
      <Newsletter />
    </>
  );
}

function Hero({ products }: { products: Product[] }) {
  const shoe = products.find((product) => product.category.toLowerCase() === "shoes") ?? products[0];
  const watch = products.find((product) => product.category.toLowerCase() === "watches") ?? products[1] ?? products[0];

  return (
    <section className="dc-hero dc-luxury-hero">
      <div className="dc-container dc-hero-grid">
        <div className="dc-hero-copy">
          <span className="dc-badge">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Premium Vrixo
          </span>
          <h1 className="dc-hero-title">Premium style for modern India</h1>
          <p className="dc-hero-text">
            Shoes and watches selected for sharp first impressions, clean daily styling, and confident checkout.
          </p>
          <div className="dc-hero-actions">
            <Link href="/category/shoes" className="dc-btn-primary">
              Shop Shoes <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/category/watches" className="dc-btn-secondary">
              Explore Watches
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {[
              ["COD", "Available"],
              ["Secure", "Online Payment"],
              ["Easy", "Returns"],
              ["Genuine", "Products"],
              ["Fast", "Support"]
            ].map(([strong, label]) => (
              <div key={label} className="dc-soft-panel px-3 py-4 text-center">
                <strong className="block text-sm font-black text-[var(--dc-black)]">{strong}</strong>
                <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dc-muted)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="dc-editorial-surface dc-hero-showcase relative overflow-hidden p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_0.82fr]">
            <SpotlightProduct product={shoe} label="Signature shoes" tall priority />
            <div className="grid gap-4">
              <SpotlightProduct product={watch} label="Timeless watches" />
              <div className="rounded-[var(--dc-radius-lg)] border border-[var(--dc-border)] bg-[var(--dc-black)] p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--dc-gold-soft)]">
                  Confidence built in
                </p>
                <p className="mt-3 text-2xl font-black leading-tight">
                  {products.length}+ curated styles ready to order.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandManifesto() {
  const principles = [
    ["Edit", "A focused catalog instead of random clutter."],
    ["Trust", "COD, secure payments, and clear support at every step."],
    ["Style", "Modern shoes and watches made for Indian daily life."],
    ["Speed", "Low-data images and fast product discovery on mobile."]
  ];

  return (
    <section className="dc-luxury-band">
      <div className="dc-container grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <span className="dc-badge dc-badge-dark">
            <Crown className="mr-2 h-3.5 w-3.5" />
            Brand code
          </span>
          <h2 className="mt-5 text-4xl font-black leading-none text-white md:text-6xl">
            Minimal. Premium. Built for repeat confidence.
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {principles.map(([title, text]) => (
            <div key={title} className="dc-dark-card p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--dc-silver)]">{title}</p>
              <p className="mt-3 text-sm leading-6 text-[#d9dce3]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpotlightProduct({
  product,
  label,
  tall = false,
  priority = false
}: {
  product?: Product;
  label: string;
  tall?: boolean;
  priority?: boolean;
}) {
  const image = normalizeProductImage(product?.images[0]) ?? getFallbackProductImage();
  const title = product ? cleanProductTitle(product.title) : "Vrixo premium pick";

  return (
    <Link
      href={product ? `/product/${product.slug}` : "/shop"}
      className={`group relative overflow-hidden rounded-[var(--dc-radius-lg)] border border-[var(--dc-border)] bg-[#fffaf3] ${
        tall ? "min-h-[420px]" : "min-h-[198px]"
      }`}
    >
      <Image
        src={image}
        alt={title}
        fill
        sizes="(min-width: 1024px) 32vw, 100vw"
        priority={priority}
        className="object-contain p-8 transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--dc-gold-soft)]">{label}</p>
        <h2 className="mt-2 line-clamp-2 text-xl font-black">{title}</h2>
        {product ? <p className="mt-1 text-sm font-bold">{formatCurrency(product.price)}</p> : null}
      </div>
    </Link>
  );
}

function TrustSection() {
  const items = [
    { icon: BadgeCheck, title: "100% Genuine Products", text: "Carefully selected shoes and watches." },
    { icon: Truck, title: "COD Available", text: "Pay when your order reaches you." },
    { icon: ShieldCheck, title: "Secure Online Payment", text: "UPI, cards, wallets, and netbanking." },
    { icon: RotateCcw, title: "Easy Returns", text: "Clear support for eligible returns." },
    { icon: Headphones, title: "Fast Customer Support", text: "Helpful assistance before and after purchase." },
    { icon: PackageCheck, title: "Selected Quality", text: "A focused catalog instead of clutter." }
  ];

  return (
    <section className="dc-section-tight">
      <div className="dc-container grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="dc-soft-panel dc-lift flex gap-4 p-5">
            <span className="dc-icon-tile shrink-0">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-[var(--dc-black)]">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--dc-muted)]">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FounderStory() {
  return (
    <section className="dc-section">
      <div className="dc-container dc-founder-panel">
        <div>
          <span className="dc-badge">Founder story</span>
          <h2 className="mt-4 text-4xl font-black leading-none text-[var(--dc-black)] md:text-6xl">
            Founded by Chavda Ravi for customers who want style without doubt.
          </h2>
        </div>
        <div className="space-y-4 text-sm leading-7 text-[var(--dc-muted)]">
          <p>
            Vrixo is built around a simple promise: make premium-looking fashion easier to discover, trust, and order.
          </p>
          <p>
            The brand direction is clean, selective, and mobile-first, with product pages designed to help customers decide quickly.
          </p>
          <Link href="/about" className="dc-btn-primary mt-2">
            Read the story <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SocialProofSection() {
  const cards = [
    { icon: ShieldCheck, title: "Checkout confidence", text: "Razorpay online payment and Cash on Delivery support." },
    { icon: MessageCircle, title: "Support-first brand", text: "WhatsApp-style assistance and clear post-order communication." },
    { icon: Quote, title: "Review-ready experience", text: "Product reviews stay authentic. No fake ratings, no inflated proof." }
  ];

  return (
    <section className="dc-section-tight">
      <div className="dc-container">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="dc-badge">Trust system</span>
            <h2 className="dc-section-title mt-4">Premium does not ask users to guess.</h2>
          </div>
          <p className="max-w-lg text-sm leading-7 text-[var(--dc-muted)]">
            Every high-intent customer should see payment safety, delivery clarity, and support reassurance before checkout.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="dc-proof-card">
              <card.icon className="h-5 w-5 text-[var(--dc-gold)]" />
              <h3 className="mt-4 text-xl font-black text-[var(--dc-black)]">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--dc-muted)]">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ViralStyleSection() {
  const ideas = ["Fit check reels", "Watch close-ups", "Founder packing orders", "Before/after styling", "Under 30 sec product demos"];

  return (
    <section className="dc-viral-strip">
      <div className="dc-container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="dc-badge dc-badge-dark">
            <Star className="mr-2 h-3.5 w-3.5" />
            Viral-ready brand
          </span>
          <h2 className="mt-4 max-w-3xl text-4xl font-black leading-none text-white md:text-6xl">
            Built to look sharp in reels, screenshots, and checkout.
          </h2>
        </div>
        <div className="grid gap-2 text-sm font-bold text-[#e7e9ee]">
          {ideas.map((idea) => (
            <span key={idea} className="rounded-full border border-white/15 bg-white/8 px-4 py-2">
              {idea}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
