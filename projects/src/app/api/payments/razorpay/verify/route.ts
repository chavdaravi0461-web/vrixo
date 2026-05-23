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

export async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "razorpay-verify", limit: 15, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = verifyRazorpaySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payment verification payload.");
  }

  const rawBody = parsed.data as VerifyRazorpayRequest;
  const body = normalizeVerifyBody(rawBody);

  if (
    !body.razorpayOrderId ||
    !body.razorpayPaymentId ||
    !body.razorpaySignature
  ) {
    return badRequest("Invalid payment verification payload.");
  }

  if (!hasRazorpayServerEnv()) {
    return serverError("Payment verification is temporarily unavailable.");
  }

  const adminSupabase = createAdminClient();
  let pendingOrder = null as {
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
  } | null;

  if (body.internalOrderId) {
    const { data } = await adminSupabase
      .from("orders")
      .select("id, user_id, order_number, total, payment_method, payment_status, order_status, customer_name, customer_phone, coupon_code, shipping_address, items")
      .eq("id", body.internalOrderId)
      .in("payment_method", ["online", "Online Payment"])
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

    const order = Array.isArray(paymentOrder?.orders)
      ? paymentOrder?.orders[0]
      : paymentOrder?.orders;

    if (order) {
      pendingOrder = order;
    }
  }

  /*
  let orderQuery = adminSupabase
    .from("orders")
    .select("id, user_id, order_number, total, payment_method, payment_status, order_status, customer_name, customer_phone, items")
    .eq("user_id", body.userId)
    .in("payment_method", ["online", "Online Payment"]);

  orderQuery = body.internalOrderId
    ? orderQuery.eq("id", body.internalOrderId)
    : orderQuery.eq("razorpay_order_id", body.razorpayOrderId);

  const { data: pendingOrder } = await orderQuery.maybeSingle();
  */

  if (!pendingOrder) {
    return conflict("Payment could not be verified. Please start payment again.");
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user: currentUser }
  } = await authSupabase.auth.getUser();

  const isOwner = Boolean(currentUser?.id && currentUser.id === pendingOrder.user_id);
  const hasValidCheckoutToken = verifyCheckoutToken(body.checkoutToken, pendingOrder.id);

  if (!isOwner && !hasValidCheckoutToken) {
    securityLog("razorpay.verify.ownership_failed", { orderId: pendingOrder.id });
    return forbidden();
  }

  const { data: orderPayment } = await adminSupabase
    .from("payments")
    .select("provider_order_id, amount, status")
    .eq("order_id", pendingOrder.id)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (orderPayment?.provider_order_id !== body.razorpayOrderId) {
    return conflict("Payment could not be verified. Please start payment again.");
  }

  if (String(pendingOrder.payment_status).toLowerCase() === "paid") {
    return NextResponse.json({
      orderId: pendingOrder.id,
      orderNumber: pendingOrder.order_number,
      paymentMethod: "online",
      paymentStatus: "paid",
      orderStatus: "Confirmed",
      smsSent: false
    });
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = getRequiredRazorpayServerEnv();
  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== body.razorpaySignature) {
    securityLog("razorpay.verify.signature_failed", { orderId: pendingOrder.id });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.");
  }

  let paymentDetailsResponse: Response;

  try {
    paymentDetailsResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${body.razorpayPaymentId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
          ).toString("base64")}`
        }
      }
    );
  } catch {
    return serverError("Payment verification is temporarily unavailable.");
  }

  const paymentDetails = (await paymentDetailsResponse.json()) as RazorpayPaymentDetails;

  if (!paymentDetailsResponse.ok) {
    return serverError("Payment verification is temporarily unavailable.");
  }

  if (paymentDetails.order_id !== body.razorpayOrderId) {
    securityLog("razorpay.verify.order_mismatch", { orderId: pendingOrder.id });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.");
  }

  const expectedAmount = Math.round(Number(pendingOrder.total ?? 0) * 100);

  if ((paymentDetails.amount ?? 0) !== expectedAmount || paymentDetails.currency !== "INR") {
    securityLog("razorpay.verify.amount_failed", { orderId: pendingOrder.id });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return badRequest("Payment verification failed.");
  }

  if (paymentDetails.status === "authorized") {
    const risk = await runPreCaptureRiskCheck({
      request,
      pendingOrder,
      items: pendingOrder.items as CartItem[],
      razorpayOrderId: body.razorpayOrderId
    });

    if (risk === "blocked") {
      await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
      return NextResponse.json({ message: "Payment requires manual support review before capture." }, { status: 403 });
    }

    const captureResult = await captureAuthorizedPayment({
      keyId: RAZORPAY_KEY_ID,
      keySecret: RAZORPAY_KEY_SECRET,
      paymentId: body.razorpayPaymentId,
      amount: expectedAmount
    });

    if ("message" in captureResult) {
      await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
      return NextResponse.json({ message: captureResult.message }, { status: captureResult.status });
    }

    Object.assign(paymentDetails, captureResult.paymentDetails);
  }

  if (paymentDetails.status !== "captured") {
    securityLog("razorpay.verify.not_captured", { orderId: pendingOrder.id, status: paymentDetails.status });
    await markOnlinePaymentFailed(adminSupabase, pendingOrder.id, body);
    return conflict("Payment was not captured. Order was not confirmed.");
  }

  try {
    await decrementStockForPaidOrder(adminSupabase, pendingOrder.items as CartItem[]);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? "Payment verified, but stock validation failed. Please contact support."
            : "Payment verified, but stock validation failed. Please contact support."
      },
      { status: 409 }
    );
  }

  const confirmedOrderStatus = "Confirmed";
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
      razorpayStatus: paymentDetails.status
    }
  };
  const updateResult = await adminSupabase
    .from("orders")
    .update(orderUpdatePayload)
    .eq("id", pendingOrder.id)
    .select("id")
    .single();

  if (updateResult.error) {
    securityLog("razorpay.verify.supabase_update_failed", { orderId: pendingOrder.id });
    return serverError("Payment verified, but order update failed. Please contact support.");
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
  await runPostOrderTasks({
    orderId: pendingOrder.id,
    orderNumber: pendingOrder.order_number,
    userId: pendingOrder.user_id,
    customerName: pendingOrder.customer_name,
    customerPhone: pendingOrder.customer_phone,
    couponCode: pendingOrder.coupon_code,
    orderStatus: confirmedOrderStatus,
    paymentMethod: "online",
    paymentStatus: "paid",
    total: Number(pendingOrder.total),
    items: items as unknown as Array<Record<string, unknown>>,
    shippingAddress: pendingOrder.shipping_address,
    sessionId: request.headers.get("x-vrixo-session"),
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId
  });

  return NextResponse.json({
    success: true,
    orderId: pendingOrder.id,
    orderNumber: pendingOrder.order_number,
    paymentMethod: "online",
    paymentStatus: "paid",
    orderStatus: "confirmed",
    whatsappQueued: true
  });
}

async function runPreCaptureRiskCheck({
  request,
  pendingOrder,
  items,
  razorpayOrderId
}: {
  request: Request;
  pendingOrder: {
    id: string;
    user_id: string;
    total: number;
    customer_phone: string;
    shipping_address: unknown;
  };
  items: CartItem[];
  razorpayOrderId: string;
}) {
  try {
    const { evaluatePaymentRisk, recordFraudAlert } = await import("@/services/fraud/fraud");
    const risk = await evaluatePaymentRisk({
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      userId: pendingOrder.user_id,
      phone: pendingOrder.customer_phone,
      paymentMethod: "online",
      shippingAddress: pendingOrder.shipping_address && typeof pendingOrder.shipping_address === "object"
        ? pendingOrder.shipping_address as Record<string, unknown>
        : {},
      orderTotal: Number(pendingOrder.total),
      items: items as unknown as Array<Record<string, unknown>>,
      razorpayOrderId
    });

    if (risk.flagged) {
      await recordFraudAlert(pendingOrder.id, {
        score: risk.score,
        action: risk.action,
        flags: risk.flags,
        reason: "razorpay_pre_capture"
      });
    }

    return risk.action === "block" ? "blocked" : "allowed";
  } catch {
    return "allowed";
  }
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
  await supabase.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
  await supabase
    .from("payments")
    .update({
      provider_payment_id: body.razorpayPaymentId,
      provider_signature: body.razorpaySignature,
      status: "failed"
    })
    .eq("order_id", orderId)
    .eq("provider_order_id", body.razorpayOrderId);
}

async function decrementStockForPaidOrder(
  supabase: ReturnType<typeof createAdminClient>,
  items: CartItem[]
) {
  for (const item of items) {
    const { data: product, error } = await supabase
      .from("products")
      .select("stock, title")
      .eq("id", item.productId)
      .single();

    if (error || !product) {
      throw new Error(`Product not found for ${item.title}.`);
    }

    const nextStock = Number(product.stock ?? 0) - Number(item.quantity ?? 0);

    if (nextStock < 0) {
      throw new Error(`Insufficient stock for ${String(product.title ?? item.title)}.`);
    }

    await supabase.from("products").update({ stock: nextStock }).eq("id", item.productId);
  }
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
}): Promise<
  | { paymentDetails: RazorpayPaymentDetails }
  | { message: string; status: number }
> {
  try {
    const captureResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency: "INR"
        })
      }
    );

    const paymentDetails = (await captureResponse.json()) as RazorpayPaymentDetails;

    if (!captureResponse.ok || paymentDetails.status !== "captured") {
      return {
        message: "Payment was authorized but could not be captured.",
        status: 409
      };
    }

    return { paymentDetails };
  } catch {
    return {
      message: "Payment was authorized but capture request failed.",
      status: 502
    };
  }
}
