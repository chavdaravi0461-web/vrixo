import type { Metadata } from "next";
import { Suspense } from "react";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { BehaviorTracker } from "@/components/store/behavior-tracker";
import { getAppUrl } from "@/lib/app-url";
import { BRAND_ICON_PATH, BRAND_LOGO_PATH, BRAND_NAME, DEFAULT_METADATA_DESCRIPTION, SUPPORT_EMAIL } from "@/lib/constants";

const appUrl = getAppUrl();
const logoUrl = `${appUrl}${BRAND_LOGO_PATH}`;
const iconUrl = `${appUrl}${BRAND_ICON_PATH}`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  verification: {
    google: "XRrKw2eNce7I1SYXJ6RNOrSmWpZJ-vwhiy7J2rdk9oI",
  },
  title: {
    default: "Vrixo - Premium Shoes & Watches",
    template: "%s | Vrixo",
  },
  description: DEFAULT_METADATA_DESCRIPTION,
  applicationName: BRAND_NAME,
  manifest: "/site.webmanifest",
  keywords: [
    "Vrixo",
    "Vrixo India",
    "premium shoes India",
    "watches online India",
    "shoes watches accessories",
    "COD shoes watches",
    "Vrixo shoes watches"
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64", type: "image/x-icon" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: BRAND_ICON_PATH, sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  openGraph: {
    title: "Vrixo - Premium Shoes & Watches",
    description: DEFAULT_METADATA_DESCRIPTION,
    siteName: BRAND_NAME,
    url: appUrl,
    type: "website",
    images: [
      {
        url: logoUrl,
        width: 900,
        height: 240,
        alt: "Vrixo logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Vrixo - Premium Shoes & Watches",
    description: DEFAULT_METADATA_DESCRIPTION,
    images: [logoUrl]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${appUrl}#organization`,
        name: "Vrixo",
        alternateName: BRAND_NAME,
        url: appUrl,
        logo: iconUrl,
        image: logoUrl,
        description: DEFAULT_METADATA_DESCRIPTION,
        founder: {
          "@type": "Person",
          name: "Chavda Ravi"
        },
        email: SUPPORT_EMAIL,
        areaServed: "IN",
        sameAs: [appUrl],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SUPPORT_EMAIL,
          areaServed: "IN"
        }
      },
      {
        "@type": "OnlineStore",
        "@id": `${appUrl}#store`,
        name: BRAND_NAME,
        url: appUrl,
        parentOrganization: {
          "@id": `${appUrl}#organization`
        },
        logo: logoUrl,
        image: iconUrl,
        description: DEFAULT_METADATA_DESCRIPTION,
        email: SUPPORT_EMAIL,
        areaServed: "IN",
        sameAs: [appUrl],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SUPPORT_EMAIL,
          areaServed: "IN"
        }
      }
    ]
  };

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Providers>
          {children}
          <Suspense fallback={null}>
            <BehaviorTracker />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
