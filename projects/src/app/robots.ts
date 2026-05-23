import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/admin/",
        "/dashboard-admin-dreamcart-ravi",
        "/dashboard-admin-dreamcart-ravi/",
        "/admin",
        "/admin/",
        "/dreamcart-owner-panel",
        "/dreamcart-owner-panel/"
      ]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
