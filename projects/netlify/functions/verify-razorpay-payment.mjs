import crypto from "node:crypto";
import {
  authHeader,
  createSupabaseAdminClient,
  createSupabasePublicClient,
  getRazorpayEnv,
  json,
  validateCartAndPrice
} from "./_payment-utils.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "Invalid request body." });
  }

  if (
    !body.userId ||
    !body.email ||
    !body.shippingAddress ||
    !Array.isArray(body.items) ||
    !body.razorpayOrderId ||
    !body.razorpayPaymentId ||
    !body.razorpaySignature
  ) {
    return json(400, { message: "Invalid payment verification payload." });
  }

  try {
    const supabase = createSupabasePublicClient();
    const { razorpayKeyId, razorpayKeySecret } = getRazorpayEnv();
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== body.razorpaySignature) {
      return json(400, { message: "Payment signature verification failed." });
    }

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("order_id")
      .eq("provider_payment_id", body.razorpayPaymentId)
      .maybeSingle();

    if (existingPayment?.order_id) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, user_id, order_number, payment_method, payment_status, order_status")
        .eq("id", existingPayment.order_id)
        .maybeSingle();

      if (existingOrder?.user_id === body.userId) {
        const existingOrderStatus =
          String(existingOrder.payment_status).toLowerCase() === "paid"
            ? "Confirmed"
            : existingOrder.order_status;
        return json(200, {
          orderId: existingOrder.id,
          orderNumber: existingOrder.order_number,
          paymentMethod: existingOrder.payment_method,
          paymentStatus: existingOrder.payment_status,
          orderStatus: existingOrderStatus
        });
      }

      return json(409, { message: "This payment has already been linked to another order." });
    }

    const pricing = await validateCartAndPrice(supabase, body.items, body.couponCode);
    let paymentDetailsResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${body.razorpayPaymentId}`,
      {
        headers: {
          Authorization: authHeader(razorpayKeyId, razorpayKeySecret)
        }
      }
    );
    let paymentDetails = await paymentDetailsResponse.json();

    if (!paymentDetailsResponse.ok) {
      return json(502, {
        message: paymentDetails.error?.description || "Failed to fetch Razorpay payment details."
      });
    }

    if (paymentDetails.order_id !== body.razorpayOrderId) {
      return json(400, { message: "Payment is linked to a different Razorpay order." });
    }

    if ((paymentDetails.amount || 0) !== pricing.amountPaise || paymentDetails.currency !== "INR") {
      return json(400, { message: "Payment amount verification failed." });
    }

    if (paymentDetails.status === "authorized") {
      const captureResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${body.razorpayPaymentId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader(razorpayKeyId, razorpayKeySecret),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: pricing.amountPaise,
            currency: "INR"
          })
        }
      );
      paymentDetails = await captureResponse.json();

      if (!captureResponse.ok || paymentDetails.status !== "captured") {
        return json(409, {
          message:
            paymentDetails.error?.description ||
            "Payment was authorized but could not be captured."
        });
      }
    }

    if (paymentDetails.status !== "captured") {
      return json(409, { message: "Payment failed or was not captured. No paid order was saved." });
    }

    const shippingAddress = {
      ...body.shippingAddress,
      paymentMeta: {
        provider: "razorpay",
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
        razorpayMethod: paymentDetails.method || "",
        razorpayStatus: paymentDetails.status
      }
    };

    const { data, error } = await supabase.rpc("create_order_with_items", {
      p_coupon_code: body.couponCode ? body.couponCode.toUpperCase() : null,
      p_items: body.items,
      p_payment_method: "online",
      p_shipping_address: shippingAddress,
      p_user_email: body.email,
      p_user_id: body.userId
    });

    if (error || !data || data.length === 0) {
      return json(500, {
        message: error?.message || "Payment verified, but the order could not be saved."
      });
    }

    const order = data[0];
    const confirmedOrderStatus = "Confirmed";

    try {
      const adminSupabase = createSupabaseAdminClient();
      await adminSupabase
        .from("orders")
        .update({
          payment_status: "paid",
          order_status: confirmedOrderStatus
        })
        .eq("id", order.order_id);
    } catch {
      // Payment is verified; keep response confirmed even if status persistence is skipped.
    }

    return json(200, {
      orderId: order.order_id,
      orderNumber: order.order_number,
      paymentMethod: "online",
      paymentStatus: "paid",
      orderStatus: confirmedOrderStatus
    });
  } catch (error) {
    return json(500, {
      message: error instanceof Error ? error.message : "Payment verification failed."
    });
  }
};
