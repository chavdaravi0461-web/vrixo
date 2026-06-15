import { NextResponse } from "next/server";
import { ensureCheckoutUser } from "@/lib/guest-customer";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "debug@test.com";
  const phone = url.searchParams.get("phone") || "9876543210";
  const name = url.searchParams.get("name") || "Debug User";

  const results: Record<string, unknown> = {};

  try {
    // Test 1: ensureCheckoutUser
    const userResult = await ensureCheckoutUser({ email, name, phone });
    results.user = { ok: true, userId: userResult.userId, isNewUser: userResult.isNewUser };
  } catch (e: any) {
    results.user = { ok: false, error: e?.message ?? String(e) };
  }

  try {
    // Test 2: Can we query profiles?
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("profiles").select("id, email, phone, name").limit(1);
    results.profiles = { ok: !error, data, error: error?.message };
  } catch (e: any) {
    results.profiles = { ok: false, error: e?.message ?? String(e) };
  }

  try {
    // Test 3: Can we query orders?
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("orders").select("id").limit(1);
    results.orders = { ok: !error, count: data?.length, error: error?.message };
  } catch (e: any) {
    results.orders = { ok: false, error: e?.message ?? String(e) };
  }

  try {
    // Test 4: Check Supabase auth admin
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    results.auth = { ok: !error, userCount: data?.users?.length, error: error?.message };
  } catch (e: any) {
    results.auth = { ok: false, error: e?.message ?? String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
