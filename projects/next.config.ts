import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "'wasm-unsafe-eval'",
  "https://checkout.razorpay.com",
  "https://js.razorpay.com",
  isDev && "https://vercel.live",
].filter(Boolean).join(" ");

const connectSrc = [
  "'self'",
  "https://rcttssjtujvntyvtclyh.supabase.co",
  "https://api.razorpay.com",
  "https://checkout.razorpay.com",
  "wss:",
  isDev && "https://vercel.live",
].filter(Boolean).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://rcttssjtujvntyvtclyh.supabase.co https://images.unsplash.com https://images.pexels.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSrc}`,
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  `connect-src ${connectSrc}`,
  "block-all-mixed-content",
  !isDev && "upgrade-insecure-requests",
].filter(Boolean).join("; ");

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
    qualities: [70, 75, 78, 82, 85],
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
        hostname: "rcttssjtujvntyvtclyh.supabase.co"
      }
    ],
    // Cache strategy - long cache for immutable assets
    dangerouslyAllowLocalIP: isDev,
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
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
          }
        ]
      },
      {
        source: "/dashboard-admin-vrixo-ravi/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Frame-Options", value: "DENY" }
        ]
      }
    ];
  }
};

export default nextConfig;
