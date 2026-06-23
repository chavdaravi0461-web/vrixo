import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { validateCouponForCheckout } from "@/lib/game-coupons";
import { safeRoute } from "@/lib/safe-route";
import { checkServerRateLimit } from "@/lib/rate-limit";

export const POST = safeRoute(async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "coupon-validate", limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    code?: string;
    subtotal?: number;
    cartTotal?: number;
  } | null;

  const subtotal = Number(body?.subtotal ?? body?.cartTotal ?? 0);

  if (!body?.code || subtotal <= 0) {
    return NextResponse.json({ message: "Coupon code and cart total are required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "Coupon validation is temporarily unavailable." }, { status: 500 });
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  const result = await validateCouponForCheckout({
    supabase: createAdminClient(),
    code: body.code.toUpperCase().trim(),
    subtotal,
    userId: user?.id ?? null
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json(result);
});
