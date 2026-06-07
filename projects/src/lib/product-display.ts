import type { Product } from "@/types/index";

export const PRODUCT_DISPLAY_SECTIONS = [
  "shop",
  "category",
  "search",
  "home",
  "hero",
  "featured",
  "best_seller",
  "new_arrival",
  "related"
] as const;

export type ProductDisplaySection = (typeof PRODUCT_DISPLAY_SECTIONS)[number];

export const DEFAULT_PRODUCT_DISPLAY_SECTIONS: ProductDisplaySection[] = [
  "shop",
  "category",
  "search",
  "home",
  "related"
];

export function normalizeDisplaySections(value: unknown): ProductDisplaySection[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const sections = raw
    .map((entry) => String(entry).trim())
    .filter((entry): entry is ProductDisplaySection =>
      PRODUCT_DISPLAY_SECTIONS.includes(entry as ProductDisplaySection)
    );

  return Array.from(new Set(sections));
}

export function getProductDisplaySections(row: Record<string, unknown>) {
  const specifications =
    row.specifications && typeof row.specifications === "object" && !Array.isArray(row.specifications)
      ? (row.specifications as Record<string, unknown>)
      : {};

  const explicit = normalizeDisplaySections(specifications.displaySections);
  if (explicit.length > 0) return explicit;

  const fallback = new Set<ProductDisplaySection>(DEFAULT_PRODUCT_DISPLAY_SECTIONS);
  if (Boolean(row.featured)) fallback.add("featured");
  if (Boolean(row.bestseller)) fallback.add("best_seller");
  if (Boolean(row.new_arrival)) fallback.add("new_arrival");
  if (Boolean(row.highlighted)) fallback.add("hero");
  return Array.from(fallback);
}

export function productShowsIn(product: Product, section: ProductDisplaySection) {
  return (product.displaySections ?? DEFAULT_PRODUCT_DISPLAY_SECTIONS).includes(section);
}
