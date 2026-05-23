import { notFound } from "next/navigation";
import { ProductActions } from "@/components/store/product-actions";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductSection } from "@/components/store/product-section";
import { ReviewsSection } from "@/components/store/reviews-section";
import { BadgeCheck, BadgePercent, PackageCheck, ShieldCheck, Star, Truck } from "lucide-react";
import { getAppUrl } from "@/lib/app-url";
import { buildMetadata } from "@/lib/metadata";
import { cleanProductDescription, cleanProductTitle, formatCurrency } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import { getProductBySlug, getRelatedProducts, getProducts } from "@/services/products";
import { getReviewsByProductId } from "@/services/reviews";
import type { Product } from "@/types/index";

// Revalidate every 3600 seconds (1 hour) for product data freshness
export const revalidate = 3600;

// Generate static params for popular products at build time
export async function generateStaticParams() {
  const allProducts = await getProducts();
  // Pre-render top 50 products for instant loading, rest on-demand
  return allProducts.slice(0, 50).map((product) => ({
    slug: product.slug
  }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return buildMetadata("Product not found");
  }

  const primaryImage = product.images[0] ?? getFallbackProductImage();
  const appUrl = getAppUrl();
  const imageUrl = primaryImage.startsWith("/") ? `${appUrl}${primaryImage}` : primaryImage;

  return {
    title: `${cleanProductTitle(product.title)} | Vrixo`,
    description: product.shortDescription || "Premium shoes and watches by Vrixo",
    openGraph: {
      title: cleanProductTitle(product.title),
      description: product.shortDescription,
      url: `${appUrl}/product/${slug}`,
      siteName: "Vrixo",
      images: [{ url: imageUrl }],
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: cleanProductTitle(product.title),
      description: product.shortDescription,
      images: [imageUrl]
    },
    alternates: {
      canonical: `${appUrl}/product/${slug}`
    }
  };
}

export default async function ProductPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const related = await getRelatedProducts(product);
  const reviews = await getReviewsByProductId(product.id);
  const displayTitle = cleanProductTitle(product.title);
  const displayDescription = cleanProductDescription(product.fullDescription);
  const productImages = product.images
    .map((image) => normalizeProductImage(image))
    .filter((image): image is string => Boolean(image));
  const primaryImage = productImages[0] ?? getFallbackProductImage();
  const appUrl = getAppUrl();
  const productUrl = `${appUrl}/product/${slug}`;
  const schemaImages = (productImages.length > 0 ? productImages : [primaryImage]).map((image) =>
    image.startsWith("/") ? `${appUrl}${image}` : image
  );

  // JSON-LD schema for product
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: displayTitle,
    image: schemaImages,
    description: product.shortDescription,
    sku: product.sku || product.slug,
    category: product.category,
    brand: {
      "@type": "Brand",
      name: "Vrixo"
    },
    offers: {
      "@type": "Offer",
      price: product.price.toString(),
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <section className="dc-container mt-6">
        <div className="dc-editorial-surface grid gap-5 p-4 lg:grid-cols-[1fr_0.95fr] lg:p-6">
          <ProductGallery images={productImages.length > 0 ? productImages : [primaryImage]} title={displayTitle} colors={product.colors} />
          <div className="p-2">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">{product.brand || product.category}</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-[var(--dc-black)] md:text-5xl">{displayTitle}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-sm font-bold text-white">
                {product.rating.toFixed(1)} <Star className="h-3.5 w-3.5 fill-white" />
              </span>
              <span className="text-sm font-semibold text-[var(--dc-muted)]">{product.reviewCount} ratings</span>
              <span className="text-sm font-semibold text-green-700">Extra offers available</span>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <p className="text-4xl font-black text-[var(--dc-black)]">{formatCurrency(product.price)}</p>
              <p className="pb-1 text-lg text-[var(--dc-muted-2)] line-through">
                {formatCurrency(product.originalPrice)}
              </p>
              {product.discountPercent > 0 ? (
                <p className="pb-1 text-lg font-black text-[var(--dc-danger)]">{product.discountPercent}% off</p>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--dc-muted)]">{displayDescription}</p>
            <div className="mt-5 grid gap-3 text-sm text-[var(--dc-text)] sm:grid-cols-3">
              <InfoChip icon={Truck} label="Delivery" value="Fast dispatch" />
              <InfoChip icon={ShieldCheck} label="Stock" value={`${product.stock} available`} />
              <InfoChip icon={BadgePercent} label="Offers" value="Coupons available" />
            </div>
            <ProductConfidencePanel />
            <ProductActions product={product} />
            <div className="mt-8 border-t border-[var(--dc-border)] pt-6">
              <ProductDetailsAccordions
                description={displayDescription}
                stock={product.stock}
                specifications={product.specifications}
              />
            </div>
          </div>
        </div>
      </section>
      <FrequentlyBoughtTogether product={product} related={related.slice(0, 2)} />
      <ProductSection
        eyebrow="Related picks"
        title="Similar products"
        description="More choices from the same category."
        products={related}
      />
      <ReviewsSection productId={product.id} reviews={reviews} />
    </>
  );
}

function ProductDetailsAccordions({
  description,
  stock,
  specifications
}: {
  description: string;
  stock: number;
  specifications: Record<string, string>;
}) {
  const specificationEntries = Object.entries(specifications);

  return (
    <div className="divide-y divide-[var(--dc-border)] border-y border-[var(--dc-border)]">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--dc-black)]">
          Product Details
          <span className="text-xl leading-none text-[var(--dc-gold)] group-open:rotate-45">+</span>
        </summary>
        <p className="pb-5 text-sm leading-7 text-[var(--dc-muted)]">{description}</p>
      </details>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--dc-black)]">
          Specifications
          <span className="text-xl leading-none text-[var(--dc-gold)] group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-3 pb-5">
          {specificationEntries.length > 0 ? (
            specificationEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-[var(--dc-muted)]">{key}</span>
                <span className="text-right font-semibold text-[var(--dc-black)]">{value}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--dc-muted)]">Premium Vrixo selection with careful quality checks.</p>
          )}
        </div>
      </details>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--dc-black)]">
          Delivery & Returns
          <span className="text-xl leading-none text-[var(--dc-gold)] group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-3 pb-5 text-sm leading-7 text-[var(--dc-muted)]">
          <p>Cash on Delivery and secure online payment are available at checkout.</p>
          <p>{stock > 0 ? `${stock} pieces currently available for dispatch.` : "This product is currently out of stock."}</p>
          <p>For returns and delivery support, review Vrixo policies from the footer links.</p>
        </div>
      </details>
    </div>
  );
}

function ProductConfidencePanel() {
  const items = [
    { icon: ShieldCheck, label: "Razorpay secure checkout" },
    { icon: Truck, label: "COD available on eligible orders" },
    { icon: BadgeCheck, label: "Genuine Vrixo selection" },
    { icon: PackageCheck, label: "Careful packing before dispatch" }
  ];

  return (
    <div className="dc-product-proof mt-5 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs font-bold text-[var(--dc-muted)]">
          <item.icon className="h-4 w-4 text-[var(--dc-gold)]" />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function FrequentlyBoughtTogether({
  product,
  related
}: {
  product: Product;
  related: Product[];
}) {
  if (related.length === 0) {
    return null;
  }

  const total = related.reduce((sum, item) => sum + item.price, product.price);

  return (
    <section className="dc-container mt-8">
      <div className="dc-fbt-panel">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">
            Frequently styled together
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-[var(--dc-black)]">
            Build a complete Vrixo look
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--dc-muted)]">
            Pair this product with related picks for a sharper outfit-ready purchase.
          </p>
        </div>
        <div className="grid gap-3">
          {[product, ...related].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] bg-white/80 p-4">
              <div>
                <p className="font-black text-[var(--dc-black)]">{cleanProductTitle(item.title)}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--dc-muted)]">
                  {item.brand || item.category}
                </p>
              </div>
              <p className="shrink-0 font-black text-[var(--dc-black)]">{formatCurrency(item.price)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-[var(--dc-radius-md)] bg-[var(--dc-black)] p-4 text-white">
            <span className="text-sm font-bold text-[#d9dce3]">Style bundle value</span>
            <strong className="text-xl">{formatCurrency(total)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--dc-radius-md)] border border-[var(--dc-border)] bg-[var(--dc-cream)] p-3">
      <Icon className="h-5 w-5 text-[var(--dc-gold)]" />
      <div>
        <p className="text-xs font-semibold text-[var(--dc-muted)]">{label}</p>
        <p className="font-bold text-[var(--dc-black)]">{value}</p>
      </div>
    </div>
  );
}
