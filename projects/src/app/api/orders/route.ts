import { NextResponse } from "next/server";
import { z } from "zod";
import { hasClientSupabaseEnv } from "@/lib/env/client";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseSetupHelpMessage } from "@/lib/supabase/setup-errors";
import { validateCouponForCheckout } from "@/lib/game-coupons";
import { addressSchema } from "@/lib/validations";
import { secureCartItemsSchema } from "@/lib/security";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { getShippingSettings } from "@/lib/shipping-settings";
import { buildOrderSnapshotFromProducts } from "@/lib/server-order-utils";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { serverError, tooManyRequests } from "@/lib/api-response";
import { runPostOrderTasks } from "@/services/orders/post-order-tasks";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";

const orderRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  couponCode: z.string().trim().max(64).optional().or(z.literal("")),
  paymentMethod: z.enum(["Cash on Delivery", "cod"]).optional(),
  shippingAddress: addressSchema,
  items: secureCartItemsSchema
});

export async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "checkout", limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid order payload." },
      { status: 400 }
    );
  }

  const body = parsed.data;

  if (!hasClientSupabaseEnv() || !hasServerSupabaseAdminEnv()) {
    return serverError("Checkout is temporarily unavailable.");
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await authSupabase.auth.getUser();

  const supabase = createPublicSupabaseClient();
  const adminSupabase = createAdminClient();
  let validatedCart: Awaited<ReturnType<typeof buildOrderSnapshotFromProducts>>;

  const checkoutUser = user
    ? { id: user.id, email: user.email ?? body.email ?? "" }
    : null;

  if (!checkoutUser) {
    return NextResponse.json(
      { message: "Please login or create an account before placing an order." },
      { status: 401 }
    );
  }

  try {
    validatedCart = await buildOrderSnapshotFromProducts(supabase, body.items);
  } catch {
    return serverError(getSupabaseSetupHelpMessage("Failed to validate order items."));
  }

  let discount = 0;
  if (body.couponCode) {
    const couponResult = await validateCouponForCheckout({
      supabase: adminSupabase,
      code: body.couponCode,
      subtotal: validatedCart.subtotal,
      userId: checkoutUser.id
    });

    if (!couponResult.ok) {
      return NextResponse.json({ message: couponResult.message }, { status: 400 });
    }

    discount = couponResult.discount;
  }

  const shippingSettings = await getShippingSettings();
  const shippingCharge = calculateShippingCharge(
    validatedCart.subtotal,
    validatedCart.snapshotItems,
    shippingSettings
  );
  const secureTotal = validatedCart.subtotal + shippingCharge - discount;

  try {
    const { evaluatePaymentRisk, blockCustomer } = await import("@/services/fraud/fraud");
    const risk = await withTimeout(evaluatePaymentRisk({
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
      userId: checkoutUser.id,
      email: body.email || checkoutUser.email || "",
      phone: String(body.shippingAddress.phone ?? ""),
      paymentMethod: "cod",
      shippingAddress: body.shippingAddress,
      orderTotal: secureTotal,
      items: validatedCart.snapshotItems
    }), 1200, null);

    if (risk?.action === "block") {
      await blockCustomer(body.email || checkoutUser.email || "", String(body.shippingAddress.phone ?? ""), risk.flags.join(","), risk.deviceFingerprint);
      return NextResponse.json({ message: "Order requires manual support review before checkout." }, { status: 403 });
    }
  } catch (error) {
    console.warn("[orders.route] pre-order fraud check failed", error);
  }

  const pendingOrderStatus = "pending";
  const codPaymentStatus = "cod_pending";
  let order: {
    order_id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    sms_item_names: string;
    sms_total_qty: number;
  };

  try {
    order = await createPendingCodOrder({
      supabase: adminSupabase,
      userId: checkoutUser.id,
      email: body.email || checkoutUser.email || "",
      shippingAddress: body.shippingAddress,
      couponCode: body.couponCode,
      snapshotItems: validatedCart.snapshotItems,
      subtotal: validatedCart.subtotal,
      discount,
      shippingCharge,
      total: secureTotal
    });
  } catch {
    return serverError(getSupabaseSetupHelpMessage("Failed to create order."));
  }

  await runPostOrderTasks({
    orderId: order.order_id,
    orderNumber: order.order_number,
    userId: checkoutUser.id,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: body.email || checkoutUser.email || "",
    couponCode: body.couponCode,
    orderStatus: pendingOrderStatus,
    paymentMethod: "cod",
    paymentStatus: codPaymentStatus,
    total: secureTotal,
    items: validatedCart.snapshotItems,
    shippingAddress: body.shippingAddress,
    sessionId: request.headers.get("x-vrixo-session")
  });

  return NextResponse.json({
    success: true,
    orderId: order.order_id,
    orderNumber: order.order_number,
    paymentMethod: "cod",
    paymentStatus: codPaymentStatus,
    orderStatus: pendingOrderStatus,
    shippingCharge,
    total: secureTotal,
    whatsappQueued: true
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || undefined;
}

async function createPendingCodOrder({
  supabase,
  userId,
  email,
  shippingAddress,
  couponCode,
  snapshotItems,
  subtotal,
  discount,
  shippingCharge,
  total
}: {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  email: string;
  shippingAddress: Record<string, unknown>;
  couponCode?: string;
  snapshotItems: Array<Record<string, unknown>>;
  subtotal: number;
  discount: number;
  shippingCharge: number;
  total: number;
}) {
  const orderId = crypto.randomUUID();
  const orderNumber = `DC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto
    .randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;
  const customerName = String(shippingAddress.fullName ?? "").trim();
  const customerPhone = sanitizeCustomerPhone(shippingAddress.phone);

  const { data: address, error: addressError } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      full_name: customerName,
      phone: customerPhone,
      line1: String(shippingAddress.line1 ?? ""),
      line2: shippingAddress.line2 ? String(shippingAddress.line2) : null,
      city: String(shippingAddress.city ?? ""),
      state: String(shippingAddress.state ?? ""),
      postal_code: String(shippingAddress.postalCode ?? ""),
      country: String(shippingAddress.country ?? "India"),
      landmark: shippingAddress.landmark ? String(shippingAddress.landmark) : null,
      is_default: false
    })
    .select("id")
    .single();

  if (addressError || !address) {
    throw new Error("address_insert_failed");
  }

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    order_number: orderNumber,
    user_id: userId,
    address_id: address.id,
    items: snapshotItems,
    subtotal,
    discount,
    shipping_charge: shippingCharge,
    total,
    total_amount: total,
    payment_method: "cod",
    payment_status: "cod_pending",
    order_status: "pending",
    shipping_address: shippingAddress,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: email,
    coupon_code: couponCode ? couponCode.toUpperCase() : null,
    whatsapp_status: "pending",
    notes: {
      email,
      strictCheckout: true,
      codRequiresAdminConfirmation: true
    }
  });

  if (orderError) {
    throw new Error("order_insert_failed");
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    snapshotItems.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      title: String(item.title ?? ""),
      sku: String(item.sku ?? ""),
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 1),
      selected_size: item.selectedSize ? String(item.selectedSize) : null,
      selected_color: item.selectedColor ? String(item.selectedColor) : null,
      product_snapshot: item
    }))
  );

  if (itemsError) {
    throw new Error("order_items_insert_failed");
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: orderId,
    provider: "manual",
    amount: total,
    currency: "INR",
    method: "cod",
    status: "cod_pending",
    raw_response: {
      strictCheckout: true
    }
  });

  if (paymentError) {
    throw new Error("payment_insert_failed");
  }

  return {
    order_id: orderId,
    order_number: orderNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    sms_item_names: snapshotItems.map((item) => String(item.title ?? "")).join(", "),
    sms_total_qty: snapshotItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
  };
}
