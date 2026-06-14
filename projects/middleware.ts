import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LEGACY_ADMIN_PATHS } from "@/lib/admin-constants";
import { getCanonicalHost } from "@/lib/canonical-host";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Permissions-Policy": 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

const isProduction = process.env.NODE_ENV === "production";
const isVercelPreview = process.env.VERCEL_ENV === "preview";
let canonicalHost = "";
if (isProduction && !isVercelPreview) {
  try { canonicalHost = getCanonicalHost(); } catch { canonicalHost = ""; }
}

function legacyAdminBlock(pathname: string): NextResponse | null {
  if (LEGACY_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return new NextResponse(null, { status: 404 });
  }
  return null;
}

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const block = legacyAdminBlock(pathname);
  if (block) return block;

  if (isProduction && canonicalHost) {
    const host = request.headers.get("host") || "";
    const currentHost = host.replace(/:\d+$/, "").replace(/^www\./i, "").toLowerCase();
    if (currentHost && currentHost !== canonicalHost.replace(/^www\./i, "").toLowerCase()) {
      const url = request.nextUrl.clone();
      url.host = canonicalHost;
      url.protocol = "https:";
      return NextResponse.redirect(url, 301);
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/data/|_next/static|_next/image|favicon.ico|site.webmanifest).*)"],
};
