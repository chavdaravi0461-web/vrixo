import "server-only";
import { NextResponse } from "next/server";
import { isOwnerAdminEmail } from "@/lib/admin-constants";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { checkServerRateLimit } from "@/lib/rate-limit";

export type RequiredAdmin = {
  user: {
    id: string;
    email?: string | null;
  };
  profile: {
    id: string;
    email?: string | null;
    role: string;
    is_active?: boolean | null;
  };
};

export async function requireAdminApi(request: Request): Promise<
  | { ok: true; admin: RequiredAdmin }
  | { ok: false; response: NextResponse }
> {
  if (!isSupabaseConfigured() || !hasServerSupabaseAdminEnv()) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Admin service is temporarily unavailable." }, { status: 500 })
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ message: "Login required." }, { status: 401 }) };
  }

  const adminSession = verifyAdminSessionToken(getRequestCookie(request, ADMIN_COOKIE_NAME));

  if (!adminSession || adminSession.sub !== user.id) {
    return { ok: false, response: NextResponse.json({ message: "Admin session required." }, { status: 401 }) };
  }

  const limited = await checkServerRateLimit(request, {
    key: "admin-api",
    limit: 120,
    windowMs: 60 * 1000
  });

  if (!limited.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      )
    };
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active === false ||
    !isOwnerAdminEmail(user.email) ||
    (profile.email ? !isOwnerAdminEmail(profile.email) : false)
  ) {
    return { ok: false, response: NextResponse.json({ message: "Admin permission required." }, { status: 403 }) };
  }

  return { ok: true, admin: { user, profile } };
}

function getRequestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
