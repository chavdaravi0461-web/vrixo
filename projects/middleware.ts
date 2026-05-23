import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LEGACY_ADMIN_PATHS,
  PRIVATE_ADMIN_PATH,
  isOwnerAdminEmail
} from "@/lib/admin-constants";
import { getCanonicalAppUrl, getCanonicalHost } from "@/lib/canonical-host";
import { normalizeStorePathname } from "@/lib/safe-navigation";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")'
};

export async function middleware(request: NextRequest) {
  const normalizedPathname = normalizeStorePathname(request.nextUrl.pathname);

  if (normalizedPathname !== request.nextUrl.pathname) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = normalizedPathname;
    return NextResponse.redirect(redirectUrl, 308);
  }

  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";
  const canonicalHost = getCanonicalHost();

  if (isProduction && canonicalHost) {
const currentHost = request.headers
.get("host")
?.replace(/^www./, "")
.toLowerCase();

const expectedHost = canonicalHost
.replace(/^www./, "")
.toLowerCase();

if (currentHost && currentHost !== expectedHost) {
const redirectUrl = request.nextUrl.clone();

redirectUrl.protocol = "https:";
redirectUrl.host = canonicalHost;

return NextResponse.redirect(redirectUrl, 301);

}
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isLegacyAdminPath(pathname)) {
    return withSecurityHeaders(new NextResponse(null, { status: 404 }), true);
  }

  const response = NextResponse.next();

  if (
    pathname.startsWith(PRIVATE_ADMIN_PATH) &&
    pathname !== `${PRIVATE_ADMIN_PATH}/login`
  ) {
    const authRedirect = await requireAdminRouteAccess(request, response);
    if (authRedirect) return authRedirect;
  }

  withSecurityHeaders(response, pathname.startsWith(PRIVATE_ADMIN_PATH));

  if (pathname.startsWith(PRIVATE_ADMIN_PATH)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-Frame-Options", "DENY");
  } else {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function isLegacyAdminPath(pathname: string) {
  return LEGACY_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function withSecurityHeaders(response: NextResponse, admin = false) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  response.headers.set("X-Frame-Options", admin ? "DENY" : "SAMEORIGIN");

  if (admin) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

async function requireAdminRouteAccess(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL(`${PRIVATE_ADMIN_PATH}/login`, request.url)),
      true
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL(`${PRIVATE_ADMIN_PATH}/login`, request.url)),
      true
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active === false ||
    !isOwnerAdminEmail(user.email) ||
    (profile.email ? !isOwnerAdminEmail(profile.email) : false)
  ) {
    return withSecurityHeaders(new NextResponse(null, { status: 404 }), true);
  }

  return null;
}
