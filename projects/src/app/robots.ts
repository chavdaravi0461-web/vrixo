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
        "/dashboard-admin-vrixo-ravi",
        "/dashboard-admin-vrixo-ravi/",
        "/admin",
        "/admin/",
        "/vrixo-owner-panel",
        "/vrixo-owner-panel/"
      ]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
