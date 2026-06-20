import { notFound } from "next/navigation";
import { ProductActions, StickyMobileBar } from "@/components/store/product-actions";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductSection } from "@/components/store/product-section";
import { ReviewsSection } from "@/components/store/reviews-section";
import { RecentlyViewedTracker } from "@/components/store/recently-viewed-tracker";
import { BadgeCheck, BadgePercent, PackageCheck, ShieldCheck, Star, Truck } from "lucide-react";
import { getAppUrl } from "@/lib/app-url";
import { buildMetadata } from "@/lib/metadata";
import { cleanProductDescription, cleanProductTitle, formatCurrency } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { getProductBySlug, getRelatedProducts, getProducts } from "@/services/products";
import { getReviewsByProductId } from "@/services/reviews";
import type { Product } from "@/types/index";

export const revalidate = 3600;

export async function generateStaticParams() {
  const allProducts = await getProducts();
  return allProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return buildMetadata("Product not found");
  const primaryImage = product.images[0] ?? getFallbackProductImage();
  const appUrl = getAppUrl();
  const imageUrl = primaryImage.startsWith("/") ? `${appUrl}${primaryImage}` : primaryImage;
  return {
    title: `${cleanProductTitle(product.title)} | Vrixo`,
    description: product.shortDescription || "Premium shoes and watches by Vrixo",
    openGraph: { title: cleanProductTitle(product.title), description: product.shortDescription, url: `${appUrl}/product/${slug}`, siteName: "Vrixo", images: [{ url: imageUrl }], type: "website" },
    twitter: { card: "summary_large_image", title: cleanProductTitle(product.title), description: product.shortDescription, images: [imageUrl] },
    alternates: { canonical: `${appUrl}/product/${slug}` }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const reviews = await getReviewsByProductId(product.id);
  const displayTitle = cleanProductTitle(product.title);
  const displayDescription = cleanProductDescription(product.fullDescription);
  const productImages = product.images.map((image) => normalizeProductImage(image)).filter((image): image is string => Boolean(image));
  const primaryImage = productImages[0] ?? getFallbackProductImage();
  const appUrl = getAppUrl();
  const productUrl = `${appUrl}/product/${slug}`;
  const schemaImages = (productImages.length > 0 ? productImages : [primaryImage]).map((image) => image.startsWith("/") ? `${appUrl}${image}` : image);

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "@id": productUrl,
    name: displayTitle,
    image: schemaImages,
    description: product.shortDescription,
    sku: product.sku || product.slug,
    category: product.category,
    brand: { "@type": "Brand", name: "Vrixo" },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: productUrl
    },
    aggregateRating: product.rating > 0 && product.reviewCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: product.rating.toFixed(1),
      ratingCount: product.reviewCount
    } : undefined
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
      { "@type": "ListItem", position: 2, name: product.category || "Shop", item: `${appUrl}/shop?category=${product.category?.toLowerCase() || ""}` },
      { "@type": "ListItem", position: 3, name: displayTitle }
    ]
  };

  const stockLabel = product.stock > 10 ? "In stock" : product.stock > 0 ? `Only ${product.stock} left in stock` : "Sold out";

  return (
    <>
      <RecentlyViewedTracker slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <section className="section" style={{ paddingTop: "24px" }}>
        <div className="container">
          <div className="glass-card" style={{ padding: "16px" }}>
            <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:p-2">
              <ProductGallery images={productImages.length > 0 ? productImages : [primaryImage]} title={displayTitle} colors={product.colors} />
              <div style={{ padding: "8px" }}>
                <p className="eyebrow" style={{ marginBottom: "8px" }}>{product.brand || product.category}</p>
                <h1 className="display-lg" style={{ letterSpacing: "-.025em", lineHeight: 1.1 }}>{displayTitle}</h1>
                <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "12px" }}>
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                    {product.rating.toFixed(1)} <Star className="h-3.5 w-3.5 fill-[var(--accent)]" />
                  </span>
                  <span className="body-sm">{product.reviewCount} ratings</span>
                </div>
                <div className="flex flex-wrap items-end gap-3" style={{ marginTop: "20px" }}>
                  <p className="display-md" style={{ fontWeight: 700 }}>{formatCurrency(product.price)}</p>
                  <p className="body-sm" style={{ textDecoration: "line-through", paddingBottom: "2px" }}>{formatCurrency(product.originalPrice)}</p>
                  {product.discountPercent > 0 ? (
                    <p className="body-sm" style={{ color: "rgba(255,80,80,.8)", fontWeight: 600 }}>{product.discountPercent}% off</p>
                  ) : null}
                </div>
                <p className="body" style={{ marginTop: "12px", lineHeight: 1.7, color: "var(--text-muted)" }}>{displayDescription}</p>
                {product.stock > 0 && product.stock <= 5 ? (
                  <p className="body-sm" style={{ marginTop: "12px", color: "rgba(255,80,80,.8)", fontWeight: 600 }}>Only {product.stock} left in stock - order soon</p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: "20px" }}>
                  <InfoChip icon={Truck} label="Delivery" value="Fast dispatch" />
                  <InfoChip icon={ShieldCheck} label="Availability" value={stockLabel} />
                  <InfoChip icon={BadgePercent} label="Checkout" value="COD and online" />
                </div>
                <ProductConfidencePanel />
                <ProductActions product={product} />
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "32px", paddingTop: "24px" }}>
                  <ProductDetailsAccordions description={displayDescription} stock={product.stock} specifications={product.specifications} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <FrequentlyBoughtTogether product={product} related={related.slice(0, 2)} />
      <ProductSection eyebrow="Related picks" title="Similar products" description="More choices from the same category." products={related} />
      <ReviewsSection productId={product.id} reviews={reviews} />
      <StickyMobileBar product={product} />
    </>
  );
}

function ProductDetailsAccordions({ description, stock, specifications }: { description: string; stock: number; specifications: Record<string, string> }) {
  const specificationEntries = Object.entries(specifications);
  return (
    <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-medium tracking-[.06em]" style={{ textTransform: "uppercase", color: "var(--text)", letterSpacing: ".06em" }}>
          Product Details
          <span className="text-lg leading-none transition-transform duration-200 group-open:rotate-45" style={{ color: "var(--text-muted)" }}>+</span>
        </summary>
        <p className="body-sm" style={{ paddingBottom: "20px" }}>{description}</p>
      </details>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-medium tracking-[.06em]" style={{ textTransform: "uppercase", color: "var(--text)", letterSpacing: ".06em" }}>
          Specifications
          <span className="text-lg leading-none transition-transform duration-200 group-open:rotate-45" style={{ color: "var(--text-muted)" }}>+</span>
        </summary>
        <div className="grid gap-3" style={{ paddingBottom: "20px" }}>
          {specificationEntries.length > 0 ? specificationEntries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: "var(--text-muted)" }}>{key}</span>
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{value}</span>
            </div>
          )) : <p className="body-sm">Premium Vrixo selection with careful quality checks.</p>}
        </div>
      </details>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-medium tracking-[.06em]" style={{ textTransform: "uppercase", color: "var(--text)", letterSpacing: ".06em" }}>
          Delivery & Returns
          <span className="text-lg leading-none transition-transform duration-200 group-open:rotate-45" style={{ color: "var(--text-muted)" }}>+</span>
        </summary>
        <div className="grid gap-3 body-sm" style={{ paddingBottom: "20px" }}>
          <p><strong>Delivery:</strong> Fast dispatch within 1-2 business days. Free delivery on eligible orders.</p>
          <p><strong>Returns:</strong> Easy 7-day return policy. Items must be unworn with tags intact. Contact support to initiate.</p>
          <p><strong>Payments:</strong> Cash on Delivery (COD) and secure online payments via Razorpay (UPI, cards, netbanking).</p>
          <p>{stock > 0 ? "Currently available for dispatch." : "This product is currently out of stock."}</p>
        </div>
      </details>
    </div>
  );
}

function ProductConfidencePanel() {
  const items = [
    { icon: ShieldCheck, label: "Razorpay secure checkout" },
    { icon: Truck, label: "Free delivery on eligible orders" },
    { icon: BadgeCheck, label: "Genuine Vrixo selection" },
    { icon: PackageCheck, label: "7-day easy returns" }
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" style={{ marginTop: "20px" }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function FrequentlyBoughtTogether({ product, related }: { product: Product; related: Product[] }) {
  if (related.length === 0) return null;
  const total = related.reduce((sum, item) => sum + item.price, product.price);
  return (
    <section className="section" style={{ paddingTop: "24px" }}>
      <div className="container">
        <div className="glass-card" style={{ padding: "24px" }}>
          <div>
            <p className="eyebrow">Frequently styled together</p>
            <h2 className="display-md" style={{ marginTop: "8px", marginBottom: "4px" }}>Build a complete Vrixo look</h2>
            <p className="body">Pair this product with related picks for a sharper outfit-ready purchase.</p>
          </div>
          <div className="grid gap-3" style={{ marginTop: "20px" }}>
            {[product, ...related].map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                <div>
                  <p style={{ fontWeight: 500, color: "var(--text)" }}>{cleanProductTitle(item.title)}</p>
                  <p className="eyebrow" style={{ marginTop: "4px" }}>{item.brand || item.category}</p>
                </div>
                <p className="p-card-price">{formatCurrency(item.price)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-[var(--radius-sm)] p-4" style={{ background: "var(--bg-card)" }}>
              <span className="body-sm">Style bundle value</span>
              <strong className="display-md" style={{ fontSize: "18px" }}>{formatCurrency(total)}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-sm)] p-3" style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
      <Icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
      <div>
        <p className="body-sm" style={{ fontSize: "11px" }}>{label}</p>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>{value}</p>
      </div>
    </div>
  );
}
