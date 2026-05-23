import {
  authHeader,
  createSupabasePublicClient,
  getRazorpayEnv,
  json,
  validateCartAndPrice
} from "./_payment-utils.mjs";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." });
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { message: "Invalid request body." });
  }

  if (!body.userId || !body.email || !body.shippingAddress || !Array.isArray(body.items)) {
    return json(400, { message: "Invalid online payment payload." });
  }

  try {
    const supabase = createSupabasePublicClient();
    const { razorpayPublicKeyId, razorpayKeyId, razorpayKeySecret } = getRazorpayEnv();
    const pricing = await validateCartAndPrice(supabase, body.items, body.couponCode);
    const receipt = `DC-PAY-${Date.now().toString().slice(-6)}`;

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader(razorpayKeyId, razorpayKeySecret),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: pricing.amountPaise,
        currency: "INR",
        receipt,
        notes: {
          brand: "Vrixo",
          internalOrderNumber: receipt,
          customerName: String(body.shippingAddress.fullName || ""),
          customerPhone: String(body.shippingAddress.phone || "")
        }
      })
    });
    const payload = await response.json();

    if (!response.ok || !payload.id) {
      const message =
        response.status === 401
          ? "Razorpay authentication failed. Use RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from the same Razorpay test key pair."
          : payload.error?.description || "Failed to create Razorpay order.";

      return json(502, {
        message
      });
    }

    return json(200, {
      razorpayOrderId: payload.id,
      amount: payload.amount || pricing.amountPaise,
      currency: payload.currency || "INR",
      receipt: payload.receipt || receipt,
      keyId: razorpayPublicKeyId,
      customer: {
        name: String(body.shippingAddress.fullName || ""),
        email: body.email,
        contact: String(body.shippingAddress.phone || "")
      }
    });
  } catch (error) {
    return json(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to reach Razorpay while creating the payment order."
    });
  }
};
