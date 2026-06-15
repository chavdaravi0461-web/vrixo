import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequiredRazorpayServerEnv,
  hasRazorpayServerEnv
} from "@/lib/env/server";
import { BRAND_NAME } from "@/lib/constants";
import { calculateShippingCharge } from "@/lib/order-pricing";
import {
  buildOrderSnapshotFromProducts,
  calculateCouponDiscount
} from "@/lib/server-order-utils";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseSetupHelpMessage } from "@/lib/supabase/setup-errors";
import { addressSchema } from "@/lib/validations";
import { secureCartItemsSchema, securityLog } from "@/lib/security";
import { getShippingSettings } from "@/lib/shipping-settings";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { createCheckoutToken, hasCheckoutTokenSecret } from "@/lib/checkout-token";
import { badRequest, serverError, tooManyRequests } from "@/lib/api-response";
import { publishEvent } from "@/lib/event-bus";
import { fetchWithTimeout, safeJson } from "@/lib/request-timeout";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import { ensureCheckoutUser } from "@/lib/guest-customer";
import { safeRoute } from "@/lib/safe-route";

const createRazorpayOrderSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  couponCode: z.string().trim().max(64).optional().or(z.literal("")),
  shippingAddress: addressSchema,
  items: secureCartItemsSchema,
  idempotencyKey: z.string().trim().max(128).optional()
});

export const POST = safeRoute(async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "razorpay-create", limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = createRazorpayOrderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid online payment payload.");
  }

  const body = parsed.data;

  if (!hasRazorpayServerEnv()) {
    return serverError("Online payment is temporarily unavailable.");
  }

  if (!hasCheckoutTokenSecret()) {
    return serverError("Online payment is temporarily unavailable.");
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await authSupabase.auth.getUser();

  const supabase = createPublicSupabaseClient();
  let validatedCart: Awaited<ReturnType<typeof buildOrderSnapshotFromProducts>>;

  try {
    validatedCart = await buildOrderSnapshotFromProducts(supabase, body.items);
  } catch {
    securityLog("razorpay.create_order.cart_validation_failed");
    return serverError(getSupabaseSetupHelpMessage("Failed to validate order items."));
  }

  let discount = 0;

  try {
    discount = await calculateCouponDiscount(createAdminClient(), body.couponCode, validatedCart.subtotal);
  } catch {
    securityLog("razorpay.create_order.coupon_validation_failed");
    return serverError(getSupabaseSetupHelpMessage("Failed to validate coupon."));
  }

  const shippingSettings = await getShippingSettings();
  const shippingCharge = calculateShippingCharge(validatedCart.subtotal, validatedCart.snapshotItems, shippingSettings);
  const total = validatedCart.subtotal + shippingCharge - discount;
  const expectedAmount = Math.round(total * 100);
  const orderNumber = `DC-PAY-${Date.now().toString().slice(-6)}`;
  const { RAZORPAY_PUBLIC_KEY_ID, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } =
    getRequiredRazorpayServerEnv();

  let payload: {
    id?: string;
    amount?: number;
    currency?: string;
    receipt?: string;
    status?: string;
    error?: { description?: string };
  };

  let checkoutUser = user
    ? { id: user.id, email: user.email ?? body.email ?? "" }
    : null;

  let tempPassword: string | undefined;

  if (!checkoutUser) {
    try {
      const customerName = String(body.shippingAddress.fullName ?? "").trim();
      const customerPhone = String(body.shippingAddress.phone ?? "").trim();
      const result = await ensureCheckoutUser({
        email: body.email, name: customerName || "Customer", phone: customerPhone,
      });
      checkoutUser = { id: result.userId, email: body.email };
      tempPassword = result.tempPassword;
    } catch (error: any) {
      return NextResponse.json({ message: "Could not create your account." }, { status: 500 });
    }
  }

  if (body.idempotencyKey) {
    const existingCheckout = await findExistingOnlineCheckout(createAdminClient(), body.idempotencyKey);
    if (existingCheckout) {
      securityLog("razorpay.create_order.idempotent_replay", {
        orderId: existingCheckout.orderId,
        razorpayOrderId: existingCheckout.razorpayOrderId
      });
      return NextResponse.json({
        success: true,
        orderId: existingCheckout.orderId,
        orderNumber: existingCheckout.orderNumber,
        checkoutToken: createCheckoutToken(existingCheckout.orderId),
        checkoutOrderNumber: existingCheckout.orderNumber,
        razorpayOrderId: existingCheckout.razorpayOrderId,
        amount: existingCheckout.amount,
        currency: existingCheckout.currency,
        receipt: existingCheckout.orderNumber,
        keyId: RAZORPAY_PUBLIC_KEY_ID,
        idempotentReplay: true,
        customer: {
          name: String(body.shippingAddress.fullName ?? ""),
          email: body.email || checkoutUser.email || "",
          contact: String(body.shippingAddress.phone ?? "")
        }
      });
    }
  }

  try {
    const { evaluatePaymentRisk, blockCustomer } = await import("@/services/fraud/fraud");
    const risk = await withTimeout(evaluatePaymentRisk({
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
      userId: checkoutUser.id,
      email: body.email || checkoutUser.email || "",
      phone: String(body.shippingAddress.phone ?? ""),
      paymentMethod: "online",
      shippingAddress: body.shippingAddress,
      orderTotal: total,
      items: validatedCart.snapshotItems
    }), 1200, null);

    if (risk?.action === "block") {
      await blockCustomer(body.email || checkoutUser.email || "", String(body.shippingAddress.phone ?? ""), risk.flags.join(","), risk.deviceFingerprint);
      return NextResponse.json({ message: "Online payment requires manual support review before checkout." }, { status: 403 });
    }
  } catch {
    securityLog("razorpay.create_order.fraud_check_failed");
  }

  try {
    securityLog("razorpay.create_order.started", { amount: expectedAmount, itemCount: body.items.length });
    const response = await fetchWithTimeout("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: expectedAmount,
        currency: "INR",
        receipt: orderNumber,
        notes: {
          brand: BRAND_NAME,
          internalOrderNumber: orderNumber,
          customerName: String(body.shippingAddress.fullName ?? ""),
          customerPhone: String(body.shippingAddress.phone ?? "")
        }
      }),
      timeoutMs: 2500
    });
    payload = ((await safeJson<typeof payload>(response)) ?? {}) as typeof payload;

    if (!response.ok || !payload.id) {
      securityLog("razorpay.create_order.failed", { status: response.status });
      return serverError("Online payment is temporarily unavailable.");
    }
  } catch {
    securityLog("razorpay.create_order.network_failed");
    return serverError("Online payment is temporarily unavailable.");
  }

  try {
    const pendingOrder = await createPendingOnlineOrder({
      supabase: createAdminClient(),
      userId: checkoutUser.id,
      email: body.email || checkoutUser.email || "",
      shippingAddress: body.shippingAddress,
      couponCode: body.couponCode,
      snapshotItems: validatedCart.snapshotItems,
      subtotal: validatedCart.subtotal,
      discount,
      shippingCharge,
      total,
      razorpayOrderId: payload.id,
      razorpayReceipt: payload.receipt ?? orderNumber,
      idempotencyKey: body.idempotencyKey
    });

    void publishEvent({
      type: "order.created",
      severity: "info",
      entityId: pendingOrder.orderId,
      entityType: "order",
      customerId: checkoutUser.id,
      payload: {
        orderNumber: pendingOrder.orderNumber,
        paymentMethod: "online",
        total,
        razorpayOrderId: payload.id
      }
    }).catch((error) => console.error("[razorpay.create_order] event publish failed", error));

    // Auto-sign-in new guest users
    if (tempPassword && body.email) {
      try {
        await authSupabase.auth.signInWithPassword({ email: body.email, password: tempPassword });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      orderId: pendingOrder.orderId,
      orderNumber: pendingOrder.orderNumber,
      checkoutToken: createCheckoutToken(pendingOrder.orderId),
      checkoutOrderNumber: orderNumber,
      razorpayOrderId: pendingOrder.razorpayOrderId,
      amount: payload.amount ?? expectedAmount,
      currency: payload.currency ?? "INR",
      receipt: payload.receipt ?? orderNumber,
      keyId: RAZORPAY_PUBLIC_KEY_ID,
      customer: {
        name: String(body.shippingAddress.fullName ?? ""),
        email: body.email || checkoutUser.email || "",
        contact: String(body.shippingAddress.phone ?? "")
      }
    });
  } catch {
    securityLog("razorpay.pending_order_save_failed", {
      reason: "pending_order_save_failed"
    });
    return serverError("Online payment order could not be started.");
  }
});

async function findExistingOnlineCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, razorpay_order_id, total, payment_status")
    .eq("idempotency_key", idempotencyKey)
    .eq("payment_method", "online")
    .maybeSingle();

  if (!order?.id || !order.razorpay_order_id || String(order.payment_status).toLowerCase() === "paid") {
    return null;
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    razorpayOrderId: order.razorpay_order_id,
    amount: Math.round(Number(order.total ?? 0) * 100),
    currency: "INR"
  };
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

async function createPendingOnlineOrder({
  supabase,
  userId,
  email,
  shippingAddress,
  couponCode,
  snapshotItems,
  subtotal,
  discount,
  shippingCharge,
  total,
  razorpayOrderId,
  razorpayReceipt,
  idempotencyKey
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
  razorpayOrderId: string;
  razorpayReceipt: string;
  idempotencyKey?: string;
}) {
  const orderId = crypto.randomUUID();
  const orderNumber = `DC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto
    .randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;
  const customerName = String(shippingAddress.fullName ?? "").trim();
  const customerPhone = sanitizeCustomerPhone(shippingAddress.phone);

  if (!customerPhone) {
    throw new Error("invalid_phone");
  }

  if (!customerName) {
    throw new Error("missing_name");
  }

  if (idempotencyKey) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, order_number, razorpay_order_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingOrder?.id && existingOrder.razorpay_order_id) {
      return {
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        razorpayOrderId: existingOrder.razorpay_order_id
      };
    }
  }

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

  if (addressError) {
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
    payment_method: "online",
    payment_status: "pending",
    order_status: "pending",
    razorpay_order_id: razorpayOrderId,
    shipping_address: shippingAddress,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: email,
    coupon_code: couponCode ? couponCode.toUpperCase() : null,
    whatsapp_status: "pending",
    idempotency_key: idempotencyKey ?? null,
    notes: {
      email,
      razorpayOrderId,
      razorpayReceipt,
      idempotencyKey
    }
  });

  if (orderError) {
    throw new Error("order_insert_failed");
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    snapshotItems.map((item) => ({
      order_id: orderId,
      product_id: typeof item.productId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productId) ? item.productId : null,
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
    provider: "razorpay",
    provider_order_id: razorpayOrderId,
    amount: total,
    currency: "INR",
    method: "online",
    status: "pending",
    raw_response: {
      receipt: razorpayReceipt
    }
  });

  if (paymentError) {
    throw new Error("payment_insert_failed");
  }

  return { orderId, orderNumber, razorpayOrderId };
}
