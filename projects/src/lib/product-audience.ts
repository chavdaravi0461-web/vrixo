import type { Product } from "@/types/index";

export type ProductAudience = "men" | "women" | "unisex";

const womenPattern = /\b(women|woman|women's|womens|ladies|lady|female|girls?|for women|women s)\b/i;
const menPattern = /\b(men|man's|mens|men's|male|gents?|boys?|for men|men s)\b/i;

export function getProductAudience(product: Product): ProductAudience {
  if (product.audience === "men" || product.audience === "women" || product.audience === "unisex") {
    return product.audience;
  }

  const text = [
    product.title,
    product.slug,
    product.category,
    product.subcategory,
    product.brand,
    product.shortDescription,
    product.fullDescription,
    ...Object.values(product.specifications ?? {})
  ].join(" ");

  if (womenPattern.test(text)) return "women";
  if (menPattern.test(text)) return "men";

  return "unisex";
}

export function productMatchesAudience(product: Product, audience?: string) {
  if (!audience) return true;

  const normalized = audience.toLowerCase();
  const productAudience = getProductAudience(product);

  if (normalized === "women" || normalized === "female" || normalized === "ladies") {
    return productAudience === "women";
  }

  if (normalized === "men" || normalized === "male" || normalized === "mens") {
    return productAudience === "men";
  }

  if (normalized === "unisex") {
    return productAudience === "unisex";
  }

  return true;
}

export function uniqueProducts(products: Product[]) {
  const seen = new Set<string>();

  return products.filter((product) => {
    const keys = [
      product.id,
      product.slug,
      `${product.title.trim().toLowerCase()}::${product.images[0] ?? ""}`
    ].filter(Boolean);

    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
