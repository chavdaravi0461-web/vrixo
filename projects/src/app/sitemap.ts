import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { getProducts } from "@/services/products";

const routes = [
  "", "/home", "/shop", "/category/shoes", "/category/watches",
  "/about", "/contact", "/contact-us", "/faq",
  "/privacy-policy", "/terms-and-conditions", "/refund-return-policy",
  "/shipping-policy", "/cancellation-policy"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const now = new Date();

  const staticPages = routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now
  }));

  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts();
    productPages = products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: new Date(product.updatedAt ?? now),
      changeFrequency: "weekly" as const,
      priority: 0.8
    }));
  } catch { /* fail silently */ }

  return [...staticPages, ...productPages];
}
