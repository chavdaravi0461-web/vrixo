import "server-only";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isOwnerAdminEmail, PRIVATE_ADMIN_PATH } from "@/lib/admin-constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";
import { sanitizeRedirectPath } from "@/lib/safe-navigation";

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();

  if (!user || !hasServerSupabaseAdminEnv()) {
    return null;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function requireUser(returnPath?: string) {
  const user = await getCurrentUser();

  if (!user) {
    const next = sanitizeRedirectPath(returnPath, "/checkout");
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return user;
}

export async function getVerifiedAdmin() {
  const user = await getCurrentUser();

  if (!user || !hasServerSupabaseAdminEnv()) {
    return null;
  }

  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!session || session.sub !== user.id) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
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
    return null;
  }

  return {
    user,
    profile
  };
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`${PRIVATE_ADMIN_PATH}/login`);
  }

  if (!hasServerSupabaseAdminEnv()) {
    throw new Error("Admin service is not configured.");
  }

  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!session || session.sub !== user.id) {
    redirect(`${PRIVATE_ADMIN_PATH}/login`);
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
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
    notFound();
  }

  return { user, profile };
}
