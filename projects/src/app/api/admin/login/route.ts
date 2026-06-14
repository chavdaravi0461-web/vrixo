import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isOwnerAdminEmail } from "@/lib/admin-constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { getIndianMobileLookupVariants, normalizeIndianMobileNumber } from "@/lib/phone";
import { adminCookieOptions, ADMIN_COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-auth";
import { checkServerRateLimit, clearServerRateLimit } from "@/lib/rate-limit";
import { logAdminAudit } from "@/lib/admin-audit";
import { safeRoute } from "@/lib/safe-route";

const adminLoginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(6),
  accessCode: z.string().trim().max(200).optional().or(z.literal(""))
});

export const POST = safeRoute(async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  const identifier = parsed.success ? parsed.data.identifier.toLowerCase() : "invalid";
  const limited = await checkServerRateLimit(request, {
    key: "admin-login",
    limit: 6,
    windowMs: 15 * 60 * 1000,
    identifier
  });

  if (!limited.allowed) {
    await logAdminAudit({ request, adminEmail: identifier, action: "admin.login.blocked", metadata: { reason: "rate_limit" } });
    return NextResponse.json({ message: "Too many login attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  if (!parsed.success) return invalidLogin(request, identifier, "invalid_payload");

  const requiredCode = process.env.ADMIN_ACCESS_CODE?.trim();
  if (requiredCode && parsed.data.accessCode !== requiredCode) return invalidLogin(request, identifier, "bad_access_code");

  const email = parsed.data.identifier.includes("@")
    ? parsed.data.identifier.toLowerCase()
    : await findEmailForMobile(parsed.data.identifier);

  if (!email || !isOwnerAdminEmail(email)) return invalidLogin(request, identifier, "unknown_identifier");

  const response = NextResponse.json({ success: true });
  const routeSupabase = createRouteHandlerSupabaseClient(request, response);
  const admin = createAdminClient();

  // Try sign in
  let { data, error } = await routeSupabase.auth.signInWithPassword({ email, password: parsed.data.password });

  // If user doesn't exist in Supabase auth, auto-provision them
  if (error && (error.message.includes("Invalid login") || error.message.includes("not found") || error.message.includes("credentials"))) {
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);

    if (!existingUser) {
      // Create the user in Supabase auth
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { name: "Admin", role: "admin" }
      });

      if (!createError && created?.user) {
        // Upsert profile as admin
        await admin.from("profiles").upsert({
          id: created.user.id,
          email,
          name: "Admin",
          role: "admin",
          is_active: true
        }, { onConflict: "id" });

        // Try sign in again
        const retry = await routeSupabase.auth.signInWithPassword({ email, password: parsed.data.password });
        data = retry.data;
        error = retry.error;
      }
    } else {
      // User exists but password doesn't match or email not confirmed
      // Update their password and confirm email
      await admin.auth.admin.updateUserById(existingUser.id, {
        password: parsed.data.password,
        email_confirm: true
      });

      // Try sign in again
      const retry = await routeSupabase.auth.signInWithPassword({ email, password: parsed.data.password });
      data = retry.data;
      error = retry.error;
    }
  }

  if (error || !data?.user || !data?.session) {
    console.error("[admin-login] final auth error:", error?.message);
    return invalidLogin(request, email, "bad_credentials");
  }

  // Verify admin profile
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", data.user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_active === false ||
    !isOwnerAdminEmail(data.user.email) ||
    (profile.email ? !isOwnerAdminEmail(profile.email) : false)
  ) {
    await routeSupabase.auth.signOut({ scope: "local" });
    return invalidLogin(request, email, "not_admin", data.user.id);
  }

  let adminSessionToken: string;
  try {
    adminSessionToken = createAdminSessionToken({ id: data.user.id, email: data.user.email });
  } catch {
    return NextResponse.json({ message: "Admin session is not configured. Check ADMIN_SESSION_SECRET." }, { status: 500 });
  }

  response.cookies.set(ADMIN_COOKIE_NAME, adminSessionToken, adminCookieOptions());
  response.cookies.delete("dc_admin_gate");
  response.cookies.delete("dc_admin_attempts");
  response.headers.set("Cache-Control", "no-store");

  await clearServerRateLimit({ key: "admin-login", request, identifier });
  await logAdminAudit({ request, adminUserId: data.user.id, adminEmail: data.user.email ?? email, action: "admin.login.success" });

  return response;
});

async function invalidLogin(request: Request, email: string, reason: string, userId?: string) {
  await logAdminAudit({ request, adminUserId: userId, adminEmail: email, action: "admin.login.failed", metadata: { reason } });
  const response = NextResponse.json({ message: "Invalid login" }, { status: 401 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function findEmailForMobile(value: string) {
  const normalizedPhone = normalizeIndianMobileNumber(value);
  if (!normalizedPhone || !hasServerSupabaseAdminEnv()) return null;
  const variants = getIndianMobileLookupVariants(normalizedPhone);
  const supabase = createAdminClient();
  const { data } = await supabase.from("profiles").select("email").in("phone", variants).not("email", "is", null).limit(1).maybeSingle();
  return data?.email ?? null;
}
