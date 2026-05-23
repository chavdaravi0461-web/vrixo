import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

const routes = [
  "",
  "/home",
  "/shop",
  "/products",
  "/category/shoes",
  "/category/watches",
  "/about",
  "/contact",
  "/contact-us",
  "/faq",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-return-policy",
  "/shipping-policy",
  "/cancellation-policy",
  "/login",
  "/signup"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const now = new Date();

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now
  }));
}
