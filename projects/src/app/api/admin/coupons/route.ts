import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/server-guards";
import { sanitizePlainText } from "@/lib/security";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

const adminCouponSchema = z.object({
  code: z.string().trim().min(3).max(40),
  description: z.string().trim().min(3).max(500),
  discountType: z.enum(["percentage", "fixed", "free_delivery"]),
  discountValue: z.coerce.number().finite().min(0).max(100000),
  minOrderAmount: z.coerce.number().finite().min(0).max(1000000),
  active: z.boolean().default(true)
});

export const POST = safeRoute(async function POST(request: Request) {
  const guard = await requireAdminApi(request);
  if (guard) return guard;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const parsed = adminCouponSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid coupon payload." },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").insert({
    code: sanitizePlainText(body.code, 40).toUpperCase(),
    description: sanitizePlainText(body.description, 500),
    discount_type: body.discountType,
    discount_value: body.discountValue,
    min_order_amount: body.minOrderAmount,
    active: body.active
  });

  if (error) {
    return serverError();
  }

  return NextResponse.json({ message: "Coupon created successfully." });
});
