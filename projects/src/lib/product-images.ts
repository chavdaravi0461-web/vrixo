export const FALLBACK_PRODUCT_IMAGE = "/placeholder-product.svg";

const allowedUrlProtocols = new Set(["http:", "https:"]);

export function isLocalFilePath(value: unknown) {
  const image = String(value ?? "").trim();

  if (!image) return false;

  return (
    /^[a-zA-Z]:[\\/]/.test(image) ||
    image.startsWith("file://") ||
    image.startsWith("\\\\") ||
    image.startsWith("/Users/") ||
    image.startsWith("/home/") ||
    /(^|[\\/])OneDrive([\\/]|$)/i.test(image) ||
    /(^|[\\/])Pictures([\\/]|$)/i.test(image) ||
    /(^|[\\/])Screenshots([\\/]|$)/i.test(image) ||
    image.includes("\\")
  );
}

export function isSafeProductImageUrl(value: unknown) {
  const image = String(value ?? "").trim();

  if (!image || isLocalFilePath(image)) {
    return false;
  }

  if (image.startsWith("/")) {
    return !image.startsWith("//") && !image.includes("..");
  }

  try {
    const url = new URL(image);
    return allowedUrlProtocols.has(url.protocol);
  } catch {
    return false;
  }
}

export function normalizeProductImage(value: unknown) {
  const image = String(value ?? "").trim();
  return isSafeProductImageUrl(image) ? image : null;
}

export function normalizeProductImages(value: unknown, options: { fallback?: boolean } = {}) {
  const rawImages = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/\r?\n|,/)
        .map((entry) => entry.trim());

  const images = Array.from(
    new Set(rawImages.map((image) => normalizeProductImage(image)).filter((image): image is string => Boolean(image)))
  );

  if (images.length === 0 && options.fallback !== false) {
    return [FALLBACK_PRODUCT_IMAGE];
  }

  return images;
}

export function getFallbackProductImage() {
  return FALLBACK_PRODUCT_IMAGE;
}
