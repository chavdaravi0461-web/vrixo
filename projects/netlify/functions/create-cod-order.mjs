import {
  createSupabaseAdminClient,
  createSupabasePublicClient,
  json
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

  if (!body.userId || !body.email || !body.shippingAddress || !Array.isArray(body.items) || body.items.length === 0) {
    return json(400, { message: "Invalid COD order payload." });
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("create_order_with_items", {
      p_coupon_code: body.couponCode ? body.couponCode.toUpperCase() : null,
      p_items: body.items,
      p_payment_method: "cod",
      p_shipping_address: body.shippingAddress,
      p_user_email: body.email,
      p_user_id: body.userId
    });

    if (error || !data || data.length === 0) {
      return json(500, {
        message: error?.message || "Failed to save COD order."
      });
    }

    const order = data[0];
    const confirmedOrderStatus = "Confirmed";
    const codPaymentStatus = "cod_pending";

    try {
      const adminSupabase = createSupabaseAdminClient();
      await adminSupabase
        .from("orders")
        .update({
          payment_status: codPaymentStatus,
          order_status: confirmedOrderStatus
        })
        .eq("id", order.order_id);
    } catch {
      // Keep the checkout response confirmed even if the follow-up status update is skipped.
    }

    return json(200, {
      orderId: order.order_id,
      orderNumber: order.order_number,
      paymentMethod: "cod",
      paymentStatus: codPaymentStatus,
      orderStatus: confirmedOrderStatus
    });
  } catch (error) {
    return json(500, {
      message: error instanceof Error ? error.message : "Failed to save COD order."
    });
  }
};
