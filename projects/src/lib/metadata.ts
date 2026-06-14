import type { Metadata } from "next";
import { getAppUrl } from "@/lib/app-url";
import { BRAND_LOGO_PATH, BRAND_NAME, DEFAULT_METADATA_DESCRIPTION } from "@/lib/constants";

export function buildMetadata(
  title: string,
  description = DEFAULT_METADATA_DESCRIPTION
): Metadata {
  const fullTitle = `${title} | ${BRAND_NAME}`;
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}${BRAND_LOGO_PATH}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: appUrl },
    openGraph: {
      title: fullTitle,
      description,
      siteName: BRAND_NAME,
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
      title: fullTitle,
      description,
      images: [logoUrl]
    }
  };
}
