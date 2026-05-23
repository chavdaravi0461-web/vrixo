import { orderNumberToPathSegment } from "@/lib/orders/order-numbers";

const ALLOWED_REDIRECT_PREFIXES = [
  "/account",
  "/cart",
  "/checkout",
  "/home",
  "/my-orders",
  "/order-success",
  "/order-success/",
  "/order/track/",
  "/product/",
  "/shop",
  "/wishlist"
] as const;

export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = "/account"
): string {
  if (!path) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(path.trim());

    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return fallback;
    }

    if (decoded.includes("..") || decoded.includes("\\")) {
      return fallback;
    }

    const allowed = ALLOWED_REDIRECT_PREFIXES.some(
      (prefix) => decoded === prefix || decoded.startsWith(prefix)
    );

    return allowed ? decoded : fallback;
  } catch {
    return fallback;
  }
}

export function buildOrderSuccessPath(
  orderNumber: string,
  params?: Record<string, string | undefined>
) {
  const segment = orderNumberToPathSegment(orderNumber);
  const base = `/order-success/${segment}`;
  const search = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
  }

  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function buildOrderTrackPath(orderNumber: string) {
  const segment = orderNumberToPathSegment(orderNumber);
  return `/order/track/${segment}`;
}

export function normalizeStorePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return pathname;
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
