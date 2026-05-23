import { createClient } from "@supabase/supabase-js";

const FREE_SHIPPING_THRESHOLD = 4999;
const SHIPPING_CHARGE = 99;
const TEST_PAYMENT_PRODUCT_SLUG = "razorpay-test-product-5";

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function getEnv() {
  const razorpayPublicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    razorpayPublicKeyId,
    razorpayKeyId,
    razorpayKeySecret,
    supabaseUrl,
    supabaseKey,
    supabaseServiceRoleKey
  };
}

export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getEnv();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export function createSupabasePublicClient() {
  const { supabaseUrl, supabaseKey } = getEnv();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
}

export function getRazorpayEnv() {
  const { razorpayPublicKeyId, razorpayKeyId, razorpayKeySecret } = getEnv();

  if (!razorpayPublicKeyId || !razorpayKeyId || !razorpayKeySecret) {
    throw new Error(
      "NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_ID, and RAZORPAY_KEY_SECRET are required."
    );
  }

  return {
    razorpayPublicKeyId,
    razorpayKeyId,
    razorpayKeySecret
  };
}

export function authHeader(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function calculateShippingCharge(subtotal, items = []) {
  if (subtotal <= 0 || isOnlyTestPaymentProduct(items)) {
    return 0;
  }

  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
}

function isOnlyTestPaymentProduct(items) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.slug === TEST_PAYMENT_PRODUCT_SLUG || item.productId === "test-payment-5"
    )
  );
}

async function calculateCouponDiscount(supabase, couponCode, subtotal) {
  if (!couponCode) {
    return 0;
  }

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", couponCode.toUpperCase())
    .eq("active", true)
    .maybeSingle();

  const now = Date.now();

  if (
    !coupon ||
    subtotal < Number(coupon.min_order_amount || 0) ||
    (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) ||
    (coupon.ends_at && new Date(coupon.ends_at).getTime() < now)
  ) {
    return 0;
  }

  return coupon.discount_type === "percentage"
    ? Math.round((subtotal * Number(coupon.discount_value || 0)) / 100)
    : Number(coupon.discount_value || 0);
}

export async function validateCartAndPrice(supabase, items, couponCode) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const { data: products, error } = await supabase
    .from("products")
    .select("id, slug, title, price, stock")
    .in("id", productIds);

  if (error) {
    throw error;
  }

  const productMap = new Map((products || []).map((product) => [String(product.id), product]));
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(String(item.productId));

    if (!product) {
      throw new Error(`Product not found for ${item.title || item.productId}.`);
    }

    if (Number(product.stock || 0) < Number(item.quantity || 0)) {
      throw new Error(`Insufficient stock for ${product.title}.`);
    }

    subtotal += Number(product.price || 0) * Number(item.quantity || 0);
  }

  const discount = await calculateCouponDiscount(supabase, couponCode, subtotal);
  const shippingCharge = calculateShippingCharge(
    subtotal,
    items.map((item) => ({
      productId: item.productId,
      slug: productMap.get(String(item.productId))?.slug || item.slug
    }))
  );
  const total = subtotal + shippingCharge - discount;

  return {
    subtotal,
    discount,
    shippingCharge,
    total,
    amountPaise: Math.round(total * 100)
  };
}
