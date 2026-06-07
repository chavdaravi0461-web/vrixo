/**
 * Safe accessor utilities for middleware.
 * Extracted to allow testing without importing Next.js internals.
 */

export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `vx-${ts}-${rand}`;
}

export function safeGetPathname(request: { nextUrl?: { pathname?: string } }): string {
  try {
    return request?.nextUrl?.pathname ?? "";
  } catch {
    return "";
  }
}

export function safeGetHost(request: { headers?: { get?: (name: string) => string | null } }): string {
  try {
    return (request?.headers?.get?.("host") || "")
      .replace(/:\d+$/, "")
      .replace(/^www\./i, "")
      .toLowerCase()
      .trim();
  } catch {
    return "";
  }
}

export function safeCanonicalHost(getCanonicalHostFn: () => string): string {
  try {
    return getCanonicalHostFn();
  } catch {
    return "";
  }
}

export function safeNormalizePathname(normalizeFn: (p: string) => string, pathname: string): string {
  try {
    return normalizeFn(pathname);
  } catch {
    return pathname;
  }
}

export function safeHeaderGet(request: { headers?: { get?: (name: string) => string | null } }, name: string): string {
  try {
    return request?.headers?.get?.(name) ?? "";
  } catch {
    return "";
  }
}
