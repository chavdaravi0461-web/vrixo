import { FREE_SHIPPING_THRESHOLD, SHIPPING_CHARGE } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CouponValidationResult =
  | {
      ok: true;
      code: string;
      discount: number;
      message: string;
      couponId?: string;
      source?: string;
    }
  | { ok: false; message: string };

type CouponRow = {
  id?: string;
  user_id?: string | null;
  code: string;
  discount_type: string;
  discount_value: number | string;
  min_order_amount?: number | string | null;
  min_order_value?: number | string | null;
  max_discount?: number | string | null;
  active?: boolean | null;
  used?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  expires_at?: string | null;
  source?: string | null;
};

export async function validateCouponForCheckout({
  supabase,
  code,
  subtotal,
  userId
}: {
  supabase: SupabaseClient;
  code?: string;
  subtotal: number;
  userId?: string | null;
}): Promise<CouponValidationResult> {
  if (!code) {
    return { ok: true, code: "", discount: 0, message: "No coupon applied." };
  }

  const normalizedCode = code.trim().toUpperCase();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error || !coupon) {
    return { ok: false, message: "Invalid coupon code." };
  }

  const row = coupon as CouponRow;
  const now = Date.now();
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const endsAt = row.expires_at
    ? new Date(row.expires_at).getTime()
    : row.ends_at
      ? new Date(row.ends_at).getTime()
      : null;
  const minOrderValue = Number(row.min_order_value ?? row.min_order_amount ?? 0);

  if (row.active === false) return { ok: false, message: "Coupon is not active." };
  if (row.used) return { ok: false, message: "Coupon has already been used." };
  if (startsAt && startsAt > now) return { ok: false, message: "Coupon is not active yet." };
  if (endsAt && endsAt < now) return { ok: false, message: "Coupon has expired." };
  if (subtotal < minOrderValue) return { ok: false, message: `Minimum cart value is Rs. ${minOrderValue}.` };
  if (row.user_id && userId && row.user_id !== userId) {
    return { ok: false, message: "This coupon belongs to another account." };
  }

  let discount = 0;
  if (row.discount_type === "percentage") {
    discount = Math.round((subtotal * Number(row.discount_value ?? 0)) / 100);
    if (row.max_discount) {
      discount = Math.min(discount, Number(row.max_discount));
    }
  } else if (row.discount_type === "free_delivery") {
    discount = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
  } else {
    discount = Number(row.discount_value ?? 0);
  }

  discount = Math.max(0, Math.min(discount, subtotal + SHIPPING_CHARGE));

  return {
    ok: true,
    code: row.code,
    discount,
    couponId: row.id,
    source: row.source ?? undefined,
    message: discount > 0 ? "Coupon applied." : "Coupon is valid."
  };
}

export async function markCouponUsed(code?: string | null, orderId?: string) {
  if (!code) return;
  const supabase = createAdminClient();
  await supabase
    .from("coupons")
    .update({
      used: true,
      used_at: new Date().toISOString(),
      used_order_id: orderId ?? null
    })
    .eq("code", code.toUpperCase())
    .eq("source", "game");
}
