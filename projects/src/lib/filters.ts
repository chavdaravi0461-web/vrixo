import type { Product } from "@/types/index";
import { slugify } from "@/lib/utils";
import { productMatchesAudience, uniqueProducts } from "@/lib/product-audience";

export type ProductQuery = {
  category?: string;
  subcategory?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  brand?: string;
  color?: string;
  size?: string;
  rating?: number;
  availability?: "in-stock";
  sort?: string;
  audience?: string;
};

export function filterProducts(products: Product[], query: ProductQuery) {
  let results = uniqueProducts(products);

  if (query.category) {
    results = results.filter((product) => product.category === query.category);
  }

  if (query.subcategory) {
    const subcategory = slugify(query.subcategory);
    results = results.filter((product) => slugify(product.subcategory) === subcategory);
  }

  if (query.audience) {
    results = results.filter((product) => productMatchesAudience(product, query.audience));
  }

  if (query.search) {
    const search = query.search.toLowerCase();
    results = results.filter((product) =>
      [product.title, product.brand, product.subcategory]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  if (query.priceMin !== undefined) {
    results = results.filter((product) => product.price >= query.priceMin!);
  }

  if (query.priceMax !== undefined) {
    results = results.filter((product) => product.price <= query.priceMax!);
  }

  if (query.brand) {
    results = results.filter((product) => product.brand === query.brand);
  }

  if (query.color) {
    results = results.filter((product) => product.colors.includes(query.color!));
  }

  if (query.size) {
    results = results.filter((product) => product.sizes.includes(query.size!));
  }

  if (query.rating) {
    results = results.filter((product) => product.rating >= query.rating!);
  }

  if (query.availability === "in-stock") {
    results = results.filter((product) => product.stock > 0);
  }

  switch (query.sort) {
    case "price-asc":
      results.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      results.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      results.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
    case "name-asc":
      results.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "popularity":
      results.sort((a, b) => b.reviewCount - a.reviewCount);
      break;
    default:
      results.sort((a, b) => getHighlightScore(b) - getHighlightScore(a) || +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
  }

  return results;
}

function getHighlightScore(product: Product) {
  let score = 0;
  if (product.featured) score += 100;
  if (product.bestseller) score += 80;
  if (product.newArrival) score += 20;
  return score;
}
