import { slugify } from "@/lib/utils";
import { sanitizePlainText } from "@/lib/security";
import { isLocalFilePath, normalizeProductImages } from "@/lib/product-images";

export type ProductStatus = "active" | "draft" | "archived";

export type ProductPayload = {
  title: string;
  slug: string;
  category: "shoes" | "watches";
  subcategory: string;
  brand: string;
  short_description: string;
  full_description: string;
  price: number;
  original_price: number;
  discount_percent: number;
  currency: string;
  stock: number;
  sku: string;
  sizes: string[];
  colors: string[];
  images: string[];
  featured: boolean;
  bestseller: boolean;
  new_arrival: boolean;
  highlighted: boolean;
  status: ProductStatus;
  specifications: Record<string, string>;
};

export function buildProductPayload(input: Record<string, unknown>) {
  const title = sanitizePlainText(input.title, 180);
  const slug = slugify(sanitizePlainText(input.slug ?? title, 180));
  const category = sanitizePlainText(input.category, 40);
  const sku = sanitizePlainText(input.sku, 80).toUpperCase();
  const price = toNumber(input.price);
  const originalPrice = toNumber(input.original_price);
  const stock = Math.max(0, Math.trunc(toNumber(input.stock)));
  const rawImages = normalizeStringArray(input.images);
  const images = normalizeProductImages(rawImages, { fallback: false });
  const specifications = normalizeSpecifications(input.specifications);

  const errors: string[] = [];

  if (title.length < 2) errors.push("Product name is required.");
  if (!slug) errors.push("Slug is required.");
  if (!["shoes", "watches"].includes(category)) errors.push("Category must be shoes or watches.");
  if (!sku) errors.push("SKU is required.");
  if (price <= 0) errors.push("Price must be greater than zero.");
  if (stock < 0) errors.push("Stock cannot be negative.");
  if (images.length === 0) errors.push("Upload at least one product image.");
  if (rawImages.some((image) => isLocalFilePath(image))) {
    errors.push("Local computer image paths are not allowed. Upload the image file instead.");
  }
  if (rawImages.some((image) => !normalizeProductImages([image], { fallback: false }).length)) {
    errors.push("Product images must be valid public URLs or safe site paths.");
  }

  const discount =
    input.discount_percent === "" || input.discount_percent === undefined
      ? calculateDiscount(price, originalPrice)
      : Math.max(0, Math.trunc(toNumber(input.discount_percent)));

  const payload: ProductPayload = {
    title,
    slug,
    category: category as ProductPayload["category"],
    subcategory: sanitizePlainText(input.subcategory, 120),
    brand: sanitizePlainText(input.brand, 120),
    short_description: sanitizePlainText(input.short_description, 500),
    full_description: sanitizePlainText(input.full_description, 5000),
    price,
    original_price: originalPrice > 0 ? originalPrice : price,
    discount_percent: discount,
    currency: sanitizePlainText(input.currency ?? "INR", 8) || "INR",
    stock,
    sku,
    sizes: normalizeStringArray(input.sizes),
    colors: normalizeStringArray(input.colors),
    images,
    featured: Boolean(input.featured),
    bestseller: Boolean(input.bestseller),
    new_arrival: Boolean(input.new_arrival),
    highlighted: Boolean(input.highlighted),
    status: normalizeStatus(input.status),
    specifications
  };

  return { payload, errors };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateDiscount(price: number, originalPrice: number) {
  if (originalPrice <= price || originalPrice <= 0) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

function normalizeStatus(value: unknown): ProductStatus {
  return value === "draft" || value === "archived" || value === "active" ? value : "active";
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePlainText(entry, 500)).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((entry) => sanitizePlainText(entry, 500))
    .filter(Boolean);
}

function normalizeSpecifications(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [sanitizePlainText(key, 120), sanitizePlainText(entry, 500)])
        .filter(([key, entry]) => key && entry)
    );
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return normalizeSpecifications(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return {};
}
