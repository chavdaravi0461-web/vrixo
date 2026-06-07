import { NextRequest, NextResponse } from "next/server";
import { isOwnerAdminEmail } from "@/lib/admin-constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { adminCookieOptions, ADMIN_COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-auth";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: NextRequest) {
  // Access code is optional extra verification only. Supabase Auth + admin role + RLS are primary security.
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const limited = await checkServerRateLimit(request, {
    key: "admin-access-code",
    limit: 5,
    windowMs: 15 * 60 * 1000
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const expectedCode = process.env.ADMIN_ACCESS_CODE?.trim();
  if (!expectedCode) {
    return NextResponse.json({ message: "Admin access code is not enabled." }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Login required." }, { status: 401 });
  }

  const { data: profile } = await createAdminClient()
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
    await logAdminAudit({
      request,
      adminUserId: user.id,
      adminEmail: user.email,
      action: "admin.access_code.failed",
      metadata: { reason: "not_admin" }
    });
    return NextResponse.json({ message: "Admin permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (String(body?.code ?? "").trim() !== expectedCode) {
    await logAdminAudit({
      request,
      adminUserId: user.id,
      adminEmail: user.email ?? profile.email,
      action: "admin.access_code.failed",
      metadata: { reason: "bad_access_code" }
    });
    return NextResponse.json({ message: "Invalid login" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    ADMIN_COOKIE_NAME,
    createAdminSessionToken({ id: user.id, email: user.email }),
    adminCookieOptions()
  );
  response.cookies.delete("dc_admin_gate");
  response.cookies.delete("dc_admin_attempts");
  response.headers.set("Cache-Control", "no-store");

  await logAdminAudit({
    request,
    adminUserId: user.id,
    adminEmail: user.email ?? profile.email,
    action: "admin.access_code.success"
  });

  return response;
});
