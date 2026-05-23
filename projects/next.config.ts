import type { NextConfig } from "next";
import path from "node:path";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https: *.supabase.co images.unsplash.com images.pexels.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "connect-src 'self' https: wss: *.supabase.co api.razorpay.com checkout.razorpay.com"
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname)
  },
  async redirects() {
    return [
      { source: "/products", destination: "/shop", permanent: true },
      { source: "/contact", destination: "/contact-us", permanent: true },
      { source: "/terms-conditions", destination: "/terms-and-conditions", permanent: true },
      { source: "/return-refund-policy", destination: "/refund-return-policy", permanent: true },
      { source: "/order/success", destination: "/my-orders", permanent: false },
      { source: "/checkout/success", destination: "/my-orders", permanent: false },
      { source: "/success", destination: "/my-orders", permanent: false },
      { source: "/orders/success/:orderNumber", destination: "/order-success/:orderNumber", permanent: true }
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    // Extended device sizes for responsive images
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    // Extended image sizes for product cards and gallery
    imageSizes: [48, 64, 96, 128, 200, 256, 384, 512],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "images.pexels.com"
      },
      {
        protocol: "https",
        hostname: "*.supabase.co"
      }
    ],
    // Cache strategy - long cache for immutable assets
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Disable static imports for more granular control
    disableStaticImages: false,
    // Advanced optimization settings
    unoptimized: false
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")"
          }
        ]
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }
        ]
      }
    ];
  }
};

export default nextConfig;
