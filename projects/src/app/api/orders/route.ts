import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { hasClientSupabaseEnv } from "@/lib/env/client";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateCouponForCheckout } from "@/lib/game-coupons";
import { addressSchema } from "@/lib/validations";
import { secureCartItemsSchema } from "@/lib/security";
import { calculateShippingCharge } from "@/lib/order-pricing";
import { defaultShippingSettings, getShippingSettings } from "@/lib/shipping-settings";
import { buildOrderSnapshotFromProducts } from "@/lib/server-order-utils";
import { runPostOrderTasks } from "@/services/orders/post-order-tasks";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import { generateRequestId } from "@/lib/observability";
import { withTimeout } from "@/lib/request-timeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COD_RESPONSE_BUDGET_MS = 2800;
const SUPABASE_INSERT_TIMEOUT_MS = 1800;
const SECONDARY_WRITE_TIMEOUT_MS = 5000;

const orderRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  couponCode: z.string().trim().max(64).optional().or(z.literal("")),
  paymentMethod: z.enum(["Cash on Delivery", "cod"]).optional(),
  shippingAddress: addressSchema,
  items: secureCartItemsSchema,
  idempotencyKey: z.string().trim().min(8).max(128).optional()
});

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type SnapshotItem = Record<string, unknown>;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type CodOrderRecord = {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  idempotent_replay: boolean;
};

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || generateRequestId();
  const startedAt = performance.now();

  try {
    console.info("[checkout.cod] request_start", JSON.stringify({ requestId, url: request.url }));

    const limited = checkMemoryRateLimit(request, {
      key: "checkout-cod",
      limit: 20,
      windowMs: 10 * 60 * 1000
    });
    if (limited.blocked) {
      return jsonError("Too many checkout attempts. Please try again shortly.", 429, "RATE_LIMITED", requestId);
    }

    const rawBody = await safeRequestJson(request);
    const parsed = orderRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      console.warn("[checkout.cod] validation_failed", JSON.stringify({ requestId, issue: firstIssue }));
      return jsonError(firstIssue?.message ?? "Invalid checkout details.", 400, "VALIDATION_ERROR", requestId);
    }

    const body = parsed.data;
    const idempotencyKey = body.idempotencyKey || buildFallbackIdempotencyKey(body.email, body.shippingAddress.phone, body.items);

    if (!hasClientSupabaseEnv() || !hasServerSupabaseAdminEnv()) {
      console.error("[checkout.cod] env_missing", JSON.stringify({ requestId }));
      return jsonError("Checkout is temporarily unavailable.", 500, "ENV_MISSING", requestId);
    }

    const nextAuthSession = await getServerSession(authOptions);
    let userId = nextAuthSession?.user?.id || null;

    if (!userId) {
      const authSupabase = await createServerSupabaseClient();
      const authResult = await withTimeout(
        authSupabase.auth.getUser(),
        1500,
        "Supabase auth lookup timed out."
      ).catch((error) => {
        console.warn("[checkout.cod] auth_lookup_failed", JSON.stringify({ requestId, error: toErrorMessage(error) }));
        return null;
      });
      const supabaseUser = authResult?.data?.user ?? null;
      if (supabaseUser) userId = supabaseUser.id;
    }

    if (!userId) {
      return jsonError("Please login or create an account before placing an order.", 401, "AUTH_REQUIRED", requestId);
    }

    const customerName = body.shippingAddress.fullName.trim();
    const customerPhone = sanitizeCustomerPhone(body.shippingAddress.phone);
    if (!customerPhone) {
      return jsonError("Invalid phone number. Please provide a valid 10-digit Indian phone number.", 400, "INVALID_PHONE", requestId, "phone");
    }

    const adminSupabase = createAdminClient();
    const existing = await findExistingOrder(adminSupabase, idempotencyKey, requestId);
    if (existing) {
      console.info("[checkout.cod] idempotent_replay", JSON.stringify({ requestId, orderId: existing.order_id, orderNumber: existing.order_number }));
      return jsonSuccess({
        orderId: existing.order_id,
        orderNumber: existing.order_number,
        paymentMethod: "cod",
        paymentStatus: "cod_pending",
        orderStatus: "pending",
        whatsappQueued: true,
        idempotentReplay: true,
        requestId
      });
    }

    const customerEmail = body.email || nextAuthSession?.user?.email || "";

    const cart = await getSafeCartSnapshot(body.items, requestId);
    const discount = await getSafeDiscount({
      supabase: adminSupabase,
      couponCode: body.couponCode,
      subtotal: cart.subtotal,
      userId,
      requestId
    });
    const shippingSettings = await withTimeout(getShippingSettings(), 500, "Shipping settings timed out.")
      .catch((error) => {
        console.warn("[checkout.cod] shipping_settings_fallback", JSON.stringify({ requestId, error: toErrorMessage(error) }));
        return defaultShippingSettings;
      });
    const shippingCharge = calculateShippingCharge(cart.subtotal, cart.snapshotItems, shippingSettings);
    const total = Math.max(0, cart.subtotal + shippingCharge - discount);

    const order = await insertCodOrder({
      supabase: adminSupabase,
      userId,
      email: customerEmail,
      customerName,
      customerPhone,
      shippingAddress: body.shippingAddress,
      couponCode: body.couponCode,
      snapshotItems: cart.snapshotItems,
      subtotal: cart.subtotal,
      discount,
      shippingCharge,
      total,
      idempotencyKey,
      requestId
    });

    void runSecondaryOrderWrites({
      supabase: adminSupabase,
      orderId: order.order_id,
      userId,
      email: customerEmail,
      customerName,
      customerPhone,
      shippingAddress: body.shippingAddress,
      snapshotItems: cart.snapshotItems,
      total,
      requestId
    });

    try {
      await runPostOrderTasks({
        orderId: order.order_id,
        orderNumber: order.order_number,
        userId,
        customerName,
        customerPhone,
        customerEmail,
        couponCode: body.couponCode,
        orderStatus: "pending",
        paymentMethod: "cod",
        paymentStatus: "cod_pending",
        total,
        items: cart.snapshotItems,
        shippingAddress: body.shippingAddress,
        sessionId: request.headers.get("x-vrixo-session"),
        requestId
      });
    } catch (error) {
      console.warn("[checkout.cod] post_order_tasks_failed", JSON.stringify({ requestId, orderId: order.order_id, error: toErrorMessage(error) }));
    }

    const durationMs = Math.round(performance.now() - startedAt);
    console.info("[checkout.cod] order_created", JSON.stringify({
      requestId,
      orderId: order.order_id,
      orderNumber: order.order_number,
      durationMs,
      budgetMs: COD_RESPONSE_BUDGET_MS
    }));

    return jsonSuccess({
      orderId: order.order_id,
      orderNumber: order.order_number,
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      orderStatus: "pending",
      shippingCharge,
      total,
      whatsappQueued: true,
      requestId
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = toErrorMessage(error);
    console.error("[checkout.cod] request_failed", JSON.stringify({ requestId, durationMs, error: message }));
    return jsonError(resolvePublicErrorMessage(message), 500, resolveErrorCode(message), requestId);
  }
}

async function safeRequestJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getSafeCartSnapshot(items: z.infer<typeof secureCartItemsSchema>, requestId: string) {
  try {
    return await withTimeout(
      buildOrderSnapshotFromProducts(createPublicSupabaseClient(), items),
      900,
      "Product validation timed out."
    );
  } catch (error) {
    console.warn("[checkout.cod] product_validation_fallback", JSON.stringify({ requestId, error: toErrorMessage(error) }));
    const snapshotItems = items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      title: item.title,
      image: item.image ?? "",
      sku: "",
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 1),
      selectedSize: item.selectedSize ?? null,
      selectedColor: item.selectedColor ?? null
    }));
    return {
      snapshotItems,
      subtotal: snapshotItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
    };
  }
}

async function getSafeDiscount({
  supabase,
  couponCode,
  subtotal,
  userId,
  requestId
}: {
  supabase: SupabaseAdmin;
  couponCode?: string;
  subtotal: number;
  userId: string;
  requestId: string;
}) {
  if (!couponCode) return 0;

  try {
    const result = await withTimeout(
      validateCouponForCheckout({ supabase, code: couponCode, subtotal, userId }),
      700,
      "Coupon validation timed out."
    );
    if (!result.ok) {
      console.warn("[checkout.cod] coupon_rejected", JSON.stringify({ requestId, message: result.message }));
      return 0;
    }
    return result.discount;
  } catch (error) {
    console.warn("[checkout.cod] coupon_validation_failed", JSON.stringify({ requestId, error: toErrorMessage(error) }));
    return 0;
  }
}

async function findExistingOrder(supabase: SupabaseAdmin, idempotencyKey: string, requestId: string): Promise<CodOrderRecord | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()),
      800,
      "Idempotency lookup timed out."
    );
    if (error) {
      console.warn("[checkout.cod] idempotency_lookup_error", JSON.stringify({ requestId, error: error.message }));
      return null;
    }
    if (!data?.id) return null;
    return {
      order_id: data.id,
      order_number: data.order_number,
      customer_name: data.customer_name ?? "",
      customer_phone: data.customer_phone ?? "",
      idempotent_replay: true
    };
  } catch (error) {
    console.warn("[checkout.cod] idempotency_lookup_failed", JSON.stringify({ requestId, error: toErrorMessage(error) }));
    return null;
  }
}

async function insertCodOrder({
  supabase,
  userId,
  email,
  customerName,
  customerPhone,
  shippingAddress,
  couponCode,
  snapshotItems,
  subtotal,
  discount,
  shippingCharge,
  total,
  idempotencyKey,
  requestId
}: {
  supabase: SupabaseAdmin;
  userId: string;
  email: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: z.infer<typeof addressSchema>;
  couponCode?: string;
  snapshotItems: SnapshotItem[];
  subtotal: number;
  discount: number;
  shippingCharge: number;
  total: number;
  idempotencyKey: string;
  requestId: string;
}): Promise<CodOrderRecord> {
  const orderId = crypto.randomUUID();
  const orderNumber = buildOrderNumber();

  const payload = {
    id: orderId,
    order_number: orderNumber,
    user_id: userId,
    items: snapshotItems,
    subtotal,
    discount,
    shipping_charge: shippingCharge,
    total,
    total_amount: total,
    payment_method: "cod",
    payment_status: "cod_pending",
    order_status: "pending",
    shipping_address: {
      ...shippingAddress,
      phone: customerPhone
    },
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: email,
    coupon_code: couponCode ? couponCode.toUpperCase() : null,
    whatsapp_status: "pending",
    idempotency_key: idempotencyKey,
    notes: {
      requestId,
      checkoutMode: "fast_cod",
      strictCheckout: true,
      codRequiresAdminConfirmation: true,
      createdBy: "api/orders"
    }
  };

  const { data, error } = await withTimeout(
    Promise.resolve(supabase
      .from("orders")
      .insert(payload)
      .select("id, order_number, customer_name, customer_phone")
      .single()),
    SUPABASE_INSERT_TIMEOUT_MS,
    "Order insert timed out."
  );

  if (error) {
    console.error("[checkout.cod] order_insert_error", JSON.stringify({ requestId, code: error.code, message: error.message, details: error.details }));

    if (error.code === "23505") {
      const existing = await findExistingOrder(supabase, idempotencyKey, requestId);
      if (existing) return existing;
    }

    throw new Error(formatSupabaseOrderError(error.message, error.code));
  }

  if (!data?.id) throw new Error("Order insert returned no order.");

  return {
    order_id: data.id,
    order_number: data.order_number,
    customer_name: data.customer_name ?? customerName,
    customer_phone: data.customer_phone ?? customerPhone,
    idempotent_replay: false
  };
}

async function runSecondaryOrderWrites({
  supabase,
  orderId,
  userId,
  email,
  customerName,
  customerPhone,
  shippingAddress,
  snapshotItems,
  total,
  requestId
}: {
  supabase: SupabaseAdmin;
  orderId: string;
  userId: string;
  email: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: z.infer<typeof addressSchema>;
  snapshotItems: SnapshotItem[];
  total: number;
  requestId: string;
}) {
  try {
    await withTimeout((async () => {
      const { data: address, error: addressError } = await supabase
        .from("addresses")
        .insert({
          user_id: userId,
          full_name: customerName,
          phone: customerPhone,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || null,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country: shippingAddress.country || "India",
          landmark: shippingAddress.landmark || null,
          is_default: false
        })
        .select("id")
        .single();

      if (!addressError && address?.id) {
        await supabase.from("orders").update({ address_id: address.id }).eq("id", orderId);
      } else if (addressError) {
        console.warn("[checkout.cod] secondary_address_failed", JSON.stringify({ requestId, orderId, error: addressError.message }));
      }

      const itemRows = snapshotItems.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        title: String(item.title ?? ""),
        sku: String(item.sku ?? ""),
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 1),
        selected_size: item.selectedSize ? String(item.selectedSize) : null,
        selected_color: item.selectedColor ? String(item.selectedColor) : null,
        product_snapshot: item
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
      if (itemsError) {
        console.warn("[checkout.cod] secondary_items_failed", JSON.stringify({ requestId, orderId, error: itemsError.message }));
      }

      const { error: paymentError } = await supabase.from("payments").insert({
        order_id: orderId,
        provider: "manual",
        amount: total,
        currency: "INR",
        method: "cod",
        status: "cod_pending",
        raw_response: { requestId, checkoutMode: "fast_cod", customerEmail: email }
      });
      if (paymentError) {
        console.warn("[checkout.cod] secondary_payment_failed", JSON.stringify({ requestId, orderId, error: paymentError.message }));
      }
    })(), SECONDARY_WRITE_TIMEOUT_MS, "Secondary order writes timed out.");
  } catch (error) {
    console.warn("[checkout.cod] secondary_writes_failed", JSON.stringify({ requestId, orderId, error: toErrorMessage(error) }));
  }
}

function buildOrderNumber() {
  return `DC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto
    .randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;
}

function buildFallbackIdempotencyKey(email: string, phone: string, items: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ email, phone, items, bucket: Math.floor(Date.now() / (5 * 60 * 1000)) }))
    .digest("hex");
}

function checkMemoryRateLimit(
  request: Request,
  options: { key: string; limit: number; windowMs: number }
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const key = `${options.key}:${ip}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { blocked: false };
  }

  current.count += 1;
  return { blocked: current.count > options.limit };
}

function formatSupabaseOrderError(message: string, code?: string) {
  const lower = message.toLowerCase();
  if (code === "PGRST204" || lower.includes("column") || lower.includes("schema cache")) {
    return "ORDER_SCHEMA_MISSING";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "ORDER_RLS_BLOCKED";
  }
  return message || "ORDER_INSERT_FAILED";
}

function resolvePublicErrorMessage(message: string) {
  if (message === "ORDER_SCHEMA_MISSING") {
    return "Checkout database schema is missing required order columns. Please run the checkout repair SQL.";
  }
  if (message === "ORDER_RLS_BLOCKED") {
    return "Checkout database permissions blocked order creation. Please run the checkout RLS repair SQL.";
  }
  if (message.includes("timed out")) {
    return "Checkout is busy. Please try again.";
  }
  return "Order could not be placed. Please try again.";
}

function resolveErrorCode(message: string) {
  if (message === "ORDER_SCHEMA_MISSING") return "ORDER_SCHEMA_MISSING";
  if (message === "ORDER_RLS_BLOCKED") return "ORDER_RLS_BLOCKED";
  if (message.includes("timed out")) return "CHECKOUT_TIMEOUT";
  return "ORDER_CREATE_FAILED";
}

function jsonSuccess(payload: Record<string, unknown>) {
  return NextResponse.json({ success: true, ...payload }, { status: 200 });
}

function jsonError(message: string, status: number, code: string, requestId: string, field?: string) {
  return NextResponse.json(
    { success: false, message, code, requestId, field },
    { status }
  );
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
