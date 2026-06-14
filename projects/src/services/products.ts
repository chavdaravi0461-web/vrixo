import { cache } from "react";
import { filterProducts, type ProductQuery } from "@/lib/filters";
import { isSupabaseConfigured } from "@/lib/utils";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { normalizeProductImages } from "@/lib/product-images";
import { uniqueProducts } from "@/lib/product-audience";
import { valkeyCache } from "@/lib/valkey";
import { getProductDisplaySections, productShowsIn } from "@/lib/product-display";
import type { Product } from "@/types/index";

const PRODUCT_CACHE_KEY = "cache:product:all_active";
const PRODUCT_CACHE_TTL = 300; // 5 minutes
const PRODUCT_CACHE_TAGS = ["products"];

// Narrow SELECT for single product detail (includes full description, specs for detail page)
const PRODUCT_DETAIL_SELECT =
  "id, slug, title, category, subcategory, brand, short_description, full_description, price, original_price, discount_percent, currency, stock, sku, sizes, colors, images, featured, bestseller, new_arrival, status, rating, review_count, specifications, created_at, updated_at";

// Minimal SELECT for product listings
const PRODUCT_LIST_SELECT =
  "id, slug, title, category, subcategory, brand, short_description, price, original_price, discount_percent, currency, stock, sizes, colors, images, featured, bestseller, new_arrival, rating, review_count, specifications";


export function mapProductRow(row: Record<string, unknown>): Product {
  const category = row.category === "watches" ? "watches" : "shoes";
  const images = normalizeProductImages(row.images);
  const status = normalizeStatus(row.status);

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    category,
    subcategory: String(row.subcategory ?? ""),
    brand: String(row.brand ?? ""),
    shortDescription: String(row.short_description ?? ""),
    fullDescription: String(row.full_description ?? ""),
    price: Number(row.price ?? 0),
    originalPrice: Number(row.original_price ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    currency: String(row.currency ?? "INR"),
    stock: Number(row.stock ?? 0),
    sku: String(row.sku ?? ""),
    sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : [],
    colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
    images,
    featured: Boolean(row.featured),
    bestseller: Boolean(row.bestseller),
    newArrival: Boolean(row.new_arrival),
    highlighted: false,
    displaySections: getProductDisplaySections(row),
    status,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    specifications: (row.specifications as Record<string, string>) ?? {},
    audience: extractAudience(row),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };
}

export async function getProducts(query: ProductQuery = {}) {
  const products = await getAllActiveProducts();
  return filterProducts(products, query);
}

// Direct optimized query by slug - used for product detail pages
export const getProductBySlugDirect = cache(async (slug: string) => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_DETAIL_SELECT)
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (error || !data) {
      return null;
    }

    return mapProductRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
});

// Fallback to full load if direct query fails
const getAllActiveProducts = cache(async () => {
  const cached = await valkeyCache.get<Product[]>(PRODUCT_CACHE_KEY);
  if (cached !== null) return cached;

  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    const products = uniqueProducts(data
      .map((row) => mapProductRow(row as Record<string, unknown>))
      .filter((product) => (product.status ?? "active") === "active"));

    await valkeyCache.set(PRODUCT_CACHE_KEY, products, {
      ttlSeconds: PRODUCT_CACHE_TTL,
      tags: PRODUCT_CACHE_TAGS,
    });

    return products;
  } catch {
    return [];
  }
});

export async function getProductBySlug(slug: string) {
  // Try fast direct query first
  const directProduct = await getProductBySlugDirect(slug);
  if (directProduct) {
    return directProduct;
  }
  
  // Fallback to full load if direct query not working
  const products = await getProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getFeaturedProducts() {
  const products = await getProducts();
  return products.filter((product) => productShowsIn(product, "featured")).slice(0, 8);
}

export async function getHighlightedProduct() {
  const products = await getProducts();
  return products.find((product) => productShowsIn(product, "hero")) ?? null;
}

export async function getBestSellerProducts() {
  const products = await getProducts();
  return products.filter((product) => productShowsIn(product, "best_seller")).slice(0, 8);
}

export async function getNewArrivalProducts() {
  const products = await getProducts();
  return products.filter((product) => productShowsIn(product, "new_arrival")).slice(0, 8);
}

export async function getRelatedProducts(product: Product) {
  const products = await getProducts({ category: product.category, displaySection: "related" });
  return products.filter((item) => item.id !== product.id).slice(0, 4);
}

export async function getHeroProducts() {
  const products = await getProducts();
  return products.filter((product) => productShowsIn(product, "hero")).slice(0, 8);
}

export async function invalidateProductCache(): Promise<void> {
  await valkeyCache.invalidateTag("products");
}

function normalizeStatus(value: unknown): Product["status"] {
  const status = String(value ?? "active").trim().toLowerCase();
  return status === "draft" || status === "archived" || status === "active" ? status : "active";
}

function extractAudience(row: Record<string, unknown>): "men" | "women" | "unisex" | undefined {
  const specs = row.specifications as Record<string, string> | null | undefined;
  const audience = specs?.audience ?? specs?.Audience;
  if (audience === "men" || audience === "women" || audience === "unisex") return audience;
  return undefined;
}
