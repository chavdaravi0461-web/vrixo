import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequiredRazorpayServerEnv,
  hasRazorpayServerEnv
} from "@/lib/env/server";
import { securityLog } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { verifyCheckoutToken } from "@/lib/checkout-token";
import { badRequest, conflict, forbidden, serverError, tooManyRequests } from "@/lib/api-response";
import type { CartItem } from "@/types/index";
import { runPostOrderTasks } from "@/services/orders/post-order-tasks";
import { logInfo, logWarn, logError, generateRequestId } from "@/lib/observability";
import { fetchWithTimeout, safeJson } from "@/lib/request-timeout";
import { getTraceId } from "@/lib/trace-context";
import { createWalEntry, commitWalEntry, rollbackWalEntry } from "@/lib/write-ahead-log";

type VerifyRazorpayRequest = {
  userId?: string;
  checkoutToken?: string;
  internalOrderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

const verifyRazorpaySchema = z.object({
  checkoutToken: z.string().trim().max(500).optional().or(z.literal("")),
  internalOrderId: z.string().uuid().optional().or(z.literal("")),
  razorpayOrderId: z.string().trim().min(6).max(120).optional(),
  razorpayPaymentId: z.string().trim().min(6).max(120).optional(),
  razorpaySignature: z.string().trim().min(20).max(300).optional(),
  razorpay_order_id: z.string().trim().min(6).max(120).optional(),
  razorpay_payment_id: z.string().trim().min(6).max(120).optional(),
  razorpay_signature: z.string().trim().min(20).max(300).optional()
});

type RazorpayPaymentDetails = {
  amount?: number;
  currency?: string;
  status?: string;
  order_id?: string;
  method?: string;
  error?: { description?: string };
};

import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const requestId = generateRequestId();
  const startTime = performance.now();
  const traceId = getTraceId();

  const rateLimit = await checkServerRateLimit(request, {
    key: "razorpay-verify",
    limit: 15,
    windowMs: 10 * 60 * 1000
  });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter, request);

  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return badRequest("Invalid JSON payload.", "INVALID_JSON", request);
  }

  const parsed = verifyRazorpaySchema.safeParse(rawBody);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payment verification payload.", "VALIDATION_ERROR", request);
  }

  const body = normalizeVerifyBody(parsed.data as VerifyRazorpayRequest);

  if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
    return badRequest("Invalid payment verification payload.", "MISSING_FIELDS", request);
  }

  if (!hasRazorpayServerEnv()) {
    return serverError("Payment verification is temporarily unavailable.", "ENV_MISSING", request);
  }

  const adminSupabase = createAdminClient();
  let pendingOrder: {
    id: string;
    user_id: string;
    order_number: string;
    total: number;
    payment_method: string;
    payment_status: string;
    order_status: string;
    customer_name: string;
    customer_phone: string;
    coupon_code: string | null;
    shipping_address: unknown;
    items: unknown;
  } | null = null;

  if (body.internalOrderId) {
    const { data } = await adminSupabase
      .from("orders")
      .select("id, user_id, order_number, total, payment_method, payment_status, order_status, customer_name, customer_phone, coupon_code, shipping_address, items")
      .eq("id", body.internalOrderId)
      .in("payment_method", ["online", "Online Payment", "online"])
      .maybeSingle();
    pendingOrder = data;
  }

  if (!pendingOrder) {
    const { data: paymentOrder } = await adminSupabase
      .from("payments")
      .select("order_id, orders!inner(id, user_id, order_number, total, payment_method, payment_status, order_status, customer_name, customer_phone, coupon_code, shipping_address, items)")
      .eq("provider", "razorpay")
      .eq("provider_order_id", body.razorpayOrderId)
      .maybeSingle();

    const orderData = Array.isArray(paymentOrder?.orders)
      ? paymentOrder?.orders[0]
      : paymentOrder?.orders;

    if (orderData) {
      pendingOrder = orderData as unknown as typeof pendingOrder;
    }
  }

  if (!pendingOrder) {
    logWarn("verify.order_not_found", { requestId, razorpayOrderId: body.razorpayOrderId });
    return conflict("Payment could not be verified. Please start payment again.", "ORDER_NOT_FOUND", request);
  }

  const authSupabase = await createServerSupabaseClient();
  const { data: { user: currentUser } } = await authSupabase.auth.getUser();

  const isOwner = Boolean(currentUser?.id && currentUser.id === pendingOrder.user_id);
  const hasValidCheckoutToken = verifyCheckoutToken(body.checkoutToken, pendingOrder.id);

  if (!isOwner && !hasValidCheckoutToken) {
    securityLog("razorpay.verify.ownership_failed", { orderId: pendingOrder.id });
    logWarn("verify.ownership_failed", { requestId, orderId: pendingOrder.id });
    return forbidden("Access denied.", request);
  }

  const { data: orderPayment } = await adminSupabase
    .from("payments")
    .select("provider_order_id, amount, status")
    .eq("order_id", pendingOrder.id)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (!orderPayment) {
    logWarn("verify.payment_record_not_found", { requestId, orderId: pendingOrder.id });
    return conflict("Payment could not be verified. Please start payment again.", "PAYMENT_NOT_FOUND", request);
  }

  if (orderPayment.provider_order_id !== body.razorpayOrderId) {
    logWarn("verify.order_id_mismatch", { requestId, orderId: pendingOrder.id });
    return conflict("Payment could not be verified. Please start payment again.", "ORDER_ID_MISMATCH", request);
  }

  if (String(pendingOrder.payment_status).toLowerCase() === "paid") {
    logInfo("verify.already_paid", { requestId, orderId: pendingOrder.id });
    return NextResponse.json({
      success: true,
      orderId: pendingOrder.id,
      orderNumber: pendingOrder.order_number,
      paymentMethod: "online",
      paymentStatus: "paid",
      orderStatus: "Confirmed",
      smsSent: false,
      requestId
    });
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = getRequiredRazorpayServerEnv();
  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
    .digest("hex");

  const sigBuffer = Buffer.from(generatedSignature, "utf8");
  const bodyBuffer = Buffer.from(body.razorpaySignature, "utf8");
  const signatureValid = sigBuffer.length === bodyBuffer.length && crypto.timingSafeEqual(sigBuffer, bodyBuffer);

  if (!signatureValid) {
    securityLog("razorpay.verify.signature_failed", { orderId: pendingOrder.id });
    logWarn("verify.signature_failed", { requestId, orderId: pendingOrder.id });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.", "SIGNATURE_FAILED", request);
  }

  let paymentDetailsResponse: Response;
  try {
    paymentDetailsResponse = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payments/${body.razorpayPaymentId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        timeoutMs: 2500
      }
    );
  } catch {
    logWarn("verify.api_fetch_error", { requestId, paymentId: body.razorpayPaymentId });
    return serverError("Payment verification is temporarily unavailable.", "API_ERROR", request);
  }

  if (!paymentDetailsResponse.ok) {
    logWarn("verify.api_fetch_failed", { requestId, status: paymentDetailsResponse.status });
    return serverError("Payment verification is temporarily unavailable.", "API_ERROR", request);
  }

  const paymentDetails = ((await safeJson<RazorpayPaymentDetails>(paymentDetailsResponse)) ?? {}) as RazorpayPaymentDetails;

  if (paymentDetails.order_id !== body.razorpayOrderId) {
    securityLog("razorpay.verify.order_mismatch", { orderId: pendingOrder.id });
    logWarn("verify.order_mismatch", { requestId, orderId: pendingOrder.id });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.", "ORDER_MISMATCH", request);
  }

  const expectedAmount = Math.round(Number(pendingOrder.total ?? 0) * 100);
  if ((paymentDetails.amount ?? 0) !== expectedAmount || paymentDetails.currency !== "INR") {
    securityLog("razorpay.verify.amount_failed", { orderId: pendingOrder.id, expected: expectedAmount, actual: paymentDetails.amount });
    logWarn("verify.amount_failed", { requestId, orderId: pendingOrder.id, expected: expectedAmount, actual: paymentDetails.amount });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.", "AMOUNT_MISMATCH", request);
  }

  const walEntry = await createWalEntry("stock.decrement", "order", pendingOrder.id, {
    orderId: pendingOrder.id,
    items: pendingOrder.items,
    razorpayOrderId: body.razorpayOrderId,
  });

  const stockError = await decrementStockForPaidOrder(adminSupabase, pendingOrder.items as CartItem[]);
  if (stockError) {
    await rollbackWalEntry(walEntry.id, stockError);
    securityLog("razorpay.verify.stock_decrement_failed", { orderId: pendingOrder.id, error: stockError });
    logError("verify.stock_decrement_failed", { requestId, orderId: pendingOrder.id, error: stockError });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return NextResponse.json(
      { success: false, message: "Insufficient stock. Payment has not been captured.", requestId },
      { status: 409 }
    );
  }

  await commitWalEntry(walEntry.id, { stockDecremented: true });

  if (paymentDetails.status === "authorized") {
    const risk = await runPreCaptureRiskCheck({ request, pendingOrder, items: pendingOrder.items as CartItem[], razorpayOrderId: body.razorpayOrderId });

    if (risk === "blocked") {
      await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
      logWarn("verify.risk_blocked", { requestId, orderId: pendingOrder.id });
      return NextResponse.json(
        { success: false, message: "Payment requires manual support review before capture.", requestId },
        { status: 403 }
      );
    }

    const captureWal = await createWalEntry("payment.capture", "order", pendingOrder.id, {
      paymentId: body.razorpayPaymentId,
      amount: expectedAmount,
      razorpayOrderId: body.razorpayOrderId,
    });

    const captureResult = await captureAuthorizedPayment({
      keyId: RAZORPAY_KEY_ID,
      keySecret: RAZORPAY_KEY_SECRET,
      paymentId: body.razorpayPaymentId,
      amount: expectedAmount
    });

    if ("message" in captureResult) {
      await rollbackWalEntry(captureWal.id, captureResult.message);
      logError("verify.capture_failed_after_stock", { requestId, orderId: pendingOrder.id, message: captureResult.message });
      // Stock already decremented; order needs manual reconciliation.
      await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
      return NextResponse.json(
        { success: false, message: "Payment capture failed after stock validation. Order is held for manual review.", requestId },
        { status: captureResult.status }
      );
    }

    await commitWalEntry(captureWal.id, { captured: true, method: captureResult.paymentDetails.method });
    Object.assign(paymentDetails, captureResult.paymentDetails);
  }

  if (paymentDetails.status !== "captured") {
    securityLog("razorpay.verify.not_captured", { orderId: pendingOrder.id, status: paymentDetails.status });
    logWarn("verify.not_captured", { requestId, orderId: pendingOrder.id, status: paymentDetails.status });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return conflict("Payment was not captured. Order was not confirmed.", "NOT_CAPTURED", request);
  }

  const paidAt = new Date().toISOString();
  const orderUpdatePayload = {
    payment_status: "paid",
    order_status: "confirmed",
    payment_method: "online",
    razorpay_order_id: body.razorpayOrderId,
    razorpay_payment_id: body.razorpayPaymentId,
    razorpay_signature: body.razorpaySignature,
    paid_at: paidAt,
    notes: {
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      razorpayPaidAt: paidAt,
      razorpayMethod: paymentDetails.method ?? "",
      razorpayStatus: paymentDetails.status,
      requestId
    }
  };

  const { error: updateError } = await adminSupabase
    .from("orders")
    .update(orderUpdatePayload)
    .eq("id", pendingOrder.id);

  if (updateError) {
    securityLog("razorpay.verify.supabase_update_failed", { orderId: pendingOrder.id, error: updateError.message });
    logError("verify.order_update_failed", { requestId, orderId: pendingOrder.id, error: updateError.message });
    return serverError("Payment verified, but order update failed. Please contact support.", "ORDER_UPDATE_FAILED", request);
  }

  await adminSupabase
    .from("payments")
    .update({
      provider_payment_id: body.razorpayPaymentId,
      provider_signature: body.razorpaySignature,
      method: paymentDetails.method ?? "online",
      status: "paid",
      raw_response: paymentDetails,
      paid_at: paidAt
    })
    .eq("order_id", pendingOrder.id)
    .eq("provider_order_id", body.razorpayOrderId);

  const items = pendingOrder.items as CartItem[];
  try {
    await runPostOrderTasks({
      orderId: pendingOrder.id,
      orderNumber: pendingOrder.order_number,
      userId: pendingOrder.user_id,
      customerName: pendingOrder.customer_name,
      customerPhone: pendingOrder.customer_phone,
      couponCode: pendingOrder.coupon_code,
      orderStatus: "confirmed",
      paymentMethod: "online",
      paymentStatus: "paid",
      total: Number(pendingOrder.total),
      items: items as unknown as Array<Record<string, unknown>>,
      shippingAddress: pendingOrder.shipping_address,
      sessionId: request.headers.get("x-vrixo-session"),
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      requestId
    });
  } catch (err) {
    logWarn("verify.post_order_tasks_failed", {
      requestId,
      orderId: pendingOrder.id,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  logInfo("verify.completed", {
    requestId,
    orderId: pendingOrder.id,
    orderNumber: pendingOrder.order_number,
    durationMs: Math.round(performance.now() - startTime)
  });

  return NextResponse.json({
    success: true,
    orderId: pendingOrder.id,
    orderNumber: pendingOrder.order_number,
    paymentMethod: "online",
    paymentStatus: "paid",
    orderStatus: "confirmed",
    emailQueued: true,
    requestId
  });
});

async function runPreCaptureRiskCheck({
  request,
  pendingOrder,
  items,
  razorpayOrderId
}: {
  request: Request;
  pendingOrder: { id: string; user_id: string; total: number; customer_phone: string; shipping_address: unknown };
  items: CartItem[];
  razorpayOrderId: string;
}) {
  try {
    const { evaluatePaymentRisk, recordFraudAlert } = await import("@/services/fraud/fraud");
    const risk = await evaluatePaymentRisk({
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
      userId: pendingOrder.user_id,
      phone: pendingOrder.customer_phone,
      paymentMethod: "online",
      shippingAddress: pendingOrder.shipping_address && typeof pendingOrder.shipping_address === "object"
        ? (pendingOrder.shipping_address as Record<string, unknown>)
        : {},
      orderTotal: Number(pendingOrder.total),
      items: items as unknown as Array<Record<string, unknown>>,
      razorpayOrderId
    });

    if (risk.flagged) {
      await recordFraudAlert(pendingOrder.id, { score: risk.score, action: risk.action, flags: risk.flags, reason: "razorpay_pre_capture" });
    }

    return risk.action === "block" ? "blocked" : "allowed";
  } catch {
    return "allowed";
  }
}

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || request.headers.get("cf-connecting-ip")
    || undefined;
}

function normalizeVerifyBody(body: VerifyRazorpayRequest) {
  return {
    userId: body.userId,
    checkoutToken: body.checkoutToken,
    internalOrderId: body.internalOrderId,
    razorpayOrderId: body.razorpayOrderId ?? body.razorpay_order_id,
    razorpayPaymentId: body.razorpayPaymentId ?? body.razorpay_payment_id,
    razorpaySignature: body.razorpaySignature ?? body.razorpay_signature
  };
}

async function markOnlinePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  body: VerifyRazorpayRequest
) {
  await supabase.from("orders").update({
    payment_status: "failed",
    last_error: "Payment verification failed"
  }).eq("id", orderId);
  await supabase
    .from("payments")
    .update({
      provider_payment_id: body.razorpayPaymentId,
      provider_signature: body.razorpaySignature,
      status: "failed",
      error_message: "Payment verification failed"
    })
    .eq("order_id", orderId)
    .eq("provider_order_id", body.razorpayOrderId);
}

async function decrementStockForPaidOrder(
  supabase: ReturnType<typeof createAdminClient>,
  items: CartItem[]
): Promise<string | null> {
  for (const item of items) {
    const { data: product, error } = await supabase
      .from("products")
      .select("stock, title")
      .eq("id", item.productId)
      .single();

    if (error || !product) {
      return `Product not found for ${item.title}.`;
    }

    const nextStock = Number(product.stock ?? 0) - Number(item.quantity ?? 0);
    if (nextStock < 0) {
      return `Insufficient stock for ${String(product.title ?? item.title)}.`;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", item.productId);

    if (updateError) {
      return `Failed to update stock for ${String(product.title ?? item.title)}.`;
    }
  }
  return null;
}

async function captureAuthorizedPayment({
  keyId,
  keySecret,
  paymentId,
  amount
}: {
  keyId: string;
  keySecret: string;
  paymentId: string;
  amount: number;
}): Promise<{ paymentDetails: RazorpayPaymentDetails } | { message: string; status: number }> {
  try {
    const captureResponse = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount, currency: "INR" }),
        timeoutMs: 2500
      }
    );

    const paymentDetails = ((await safeJson<RazorpayPaymentDetails>(captureResponse)) ?? {}) as RazorpayPaymentDetails;

    if (!captureResponse.ok || paymentDetails.status !== "captured") {
      return { message: "Payment was authorized but could not be captured.", status: 409 };
    }

    return { paymentDetails };
  } catch {
    return { message: "Payment was authorized but capture request failed.", status: 502 };
  }
}
