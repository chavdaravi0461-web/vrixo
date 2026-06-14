import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "@/styles/globals.css";
import "@/styles/commerce-os.css";
import { Providers } from "@/components/providers";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { BackgroundEffects } from "@/components/store/background-effects";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vrixo.in"),
  title: {
    default: "Vrixo - Premium Shoes & Watches",
    template: "%s | Vrixo",
  },
  description: "Shop Vrixo premium shoes and timeless watches with COD, secure online payment, easy returns, and genuine products.",
  applicationName: "Vrixo",
  manifest: "/site.webmanifest",
  verification: {
    google: "XRrKw2eNce7I1SYXJ6RNOrSmWpZJ-vwhiy7J2rdk9oI",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 64x64", type: "image/x-icon" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    title: "Vrixo - Premium Shoes & Watches",
    description: "Shop Vrixo premium shoes and timeless watches with COD, secure online payment, easy returns, and genuine products.",
    siteName: "Vrixo",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>
        <Providers>
          <SessionProvider>
            <BackgroundEffects />
            {children}
          </SessionProvider>
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
