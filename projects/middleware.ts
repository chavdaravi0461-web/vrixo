import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LEGACY_ADMIN_PATHS, PRIVATE_ADMIN_PATH } from "@/lib/admin-constants";
import { getCanonicalHost } from "@/lib/canonical-host";
import { normalizeStorePathname } from "@/lib/safe-navigation";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy":
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
};

const MIDDLEWARE_TIMEOUT_MS = 10_000;

function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `vx-${ts}-${rand}`;
}

function logMiddleware(level: "info" | "warn" | "error", message: string, meta: Record<string, unknown> = {}) {
  const payload = JSON.stringify({ level, message, ts: new Date().toISOString(), ...meta });
  if (level === "error") console.error("[vrixo.middleware]", payload);
  else if (level === "warn") console.warn("[vrixo.middleware]", payload);
  else console.info("[vrixo.middleware]", payload);
}

async function withMiddlewareTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("MIDDLEWARE_TIMEOUT")), timeoutMs);
      }),
    ]);
    return result;
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeGetHeader(request: NextRequest, name: string): string {
  try {
    return request.headers.get(name) ?? "";
  } catch {
    return "";
  }
}

function safeGetPathname(request: NextRequest): string {
  try {
    return request.nextUrl.pathname ?? "";
  } catch {
    return "";
  }
}

function safeGetHost(request: NextRequest): string {
  try {
    return (request.headers.get("host") || "")
      .replace(/:\d+$/, "")
      .replace(/^www\./i, "")
      .toLowerCase()
      .trim();
  } catch {
    return "";
  }
}

function safeCanonicalHost(): string {
  try {
    return getCanonicalHost();
  } catch {
    return "";
  }
}

function safeNormalizePathname(pathname: string): string {
  try {
    return normalizeStorePathname(pathname);
  } catch {
    return pathname;
  }
}

function legacyAdminBlock(pathname: string): NextResponse | null {
  try {
    if (LEGACY_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return withSecurityHeaders(new NextResponse(null, { status: 404 }), true);
    }
  } catch {
    // fail closed — block on error
    return new NextResponse(null, { status: 404 });
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = generateRequestId();
  const pathname = safeGetPathname(request);
  const method = request.method ?? "GET";

  try {
    const timeoutFallback = NextResponse.next();
    return await withMiddlewareTimeout(
      executeMiddleware(request, pathname, requestId, start, method),
      MIDDLEWARE_TIMEOUT_MS,
      timeoutFallback
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logMiddleware("error", "middleware.catastrophic_failure", {
      requestId,
      pathname,
      error: errMsg,
      durationMs: Date.now() - start,
    });
    return NextResponse.next();
  }
}

async function executeMiddleware(
  request: NextRequest,
  pathname: string,
  requestId: string,
  start: number,
  method: string
): Promise<NextResponse> {
  const host = safeGetHost(request);
  logMiddleware("info", "middleware.request", { requestId, pathname, method, host });

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    withSecurityHeaders(response, false);
    response.headers.set("x-request-id", requestId);
    logMiddleware("info", "middleware.complete", { requestId, pathname, durationMs: Date.now() - start, action: "api_pass" });
    return response;
  }

  const normalizedPathname = safeNormalizePathname(pathname);

  if (normalizedPathname !== pathname) {
    try {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = normalizedPathname;
      logMiddleware("info", "middleware.redirect_path", { requestId, from: pathname, to: normalizedPathname });
      return NextResponse.redirect(redirectUrl, 308);
    } catch {
      // fall through if redirect construction fails
    }
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    logMiddleware("info", "middleware.complete", { requestId, pathname, durationMs: Date.now() - start, action: "static_pass" });
    return response;
  }

  const block = legacyAdminBlock(pathname);
  if (block) {
    block.headers.set("x-request-id", requestId);
    logMiddleware("info", "middleware.complete", { requestId, pathname, durationMs: Date.now() - start, action: "legacy_admin_block" });
    return block;
  }

  const canonicalHost = safeCanonicalHost();
  const isProduction = process.env.NODE_ENV === "production";
  const isVercelPreview = process.env.VERCEL_ENV === "preview";

  if (isProduction && canonicalHost && !isVercelPreview) {
    const currentHost = host;
    const expectedHost = canonicalHost
      .replace(/^www\./i, "")
      .toLowerCase()
      .trim();

    if (currentHost && currentHost !== expectedHost) {
      try {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.protocol = "https:";
        redirectUrl.host = canonicalHost;
        logMiddleware("info", "middleware.canonical_redirect", {
          requestId,
          from: currentHost,
          to: canonicalHost,
          pathname,
        });
        return NextResponse.redirect(redirectUrl, 301);
      } catch {
        // fall through if redirect fails
      }
    }
  }

  const response = NextResponse.next();
  withSecurityHeaders(response, pathname.startsWith(PRIVATE_ADMIN_PATH));

  if (pathname.startsWith(PRIVATE_ADMIN_PATH)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-Frame-Options", "DENY");
  } else {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  response.headers.set("x-request-id", requestId);
  logMiddleware("info", "middleware.complete", { requestId, pathname, durationMs: Date.now() - start, action: "pass" });
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/data/|_next/static|_next/image|favicon.ico).*)"]
};

function withSecurityHeaders(response: NextResponse, admin = false) {
  try {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    response.headers.set("X-Frame-Options", admin ? "DENY" : "SAMEORIGIN");

    if (admin) {
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
  } catch {
    // non-critical — security headers are best-effort
  }
  return response;
}
