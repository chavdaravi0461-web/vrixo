import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { getWhatsAppServerEnv, formatWhatsAppPhone } from "@/lib/whatsapp";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { getCustomerFromWhatsApp } from "@/lib/whatsapp/customer-context";

function trace(event: string, details?: Record<string, unknown>) {
  console.log(`[TRACE] ${event}`, details ?? {});
}

async function callOpenAISystem(prompt: string) {
  trace("AI_STARTED", {
    handler: "legacy_support.ts",
    provider: "groq",
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
  });
  if (!process.env.GROQ_API_KEY) {
    trace("AI_FAILED", { handler: "legacy_support.ts", reason: "missing_GROQ_API_KEY" });
    trace("FALLBACK_USED", { handler: "legacy_support.ts", fallback: "contextual_template" });
    return [
      "Namaste, I am Vrixo Concierge.",
      "I can help with orders, tracking, products, payments, COD, returns, or cancellations.",
      "What would you like me to handle first?"
    ].join(" ");
  }
  const { generateCustomerChatResponse } = await import("@/lib/ai/provider");
  const reply = await generateCustomerChatResponse([{ role: "user", content: prompt }], null, null, null);
  trace("AI_SUCCESS", { handler: "legacy_support.ts", replyLength: reply.length });
  return reply;
}

/** @deprecated Use processWhatsAppMessage from @/lib/whatsapp/intelligence instead. */
export async function handleWhatsAppSupportMessage({ from, text }: { from: string; text: string }) {
  trace("PROCESSOR_SELECTED", { processor: "legacy_support.ts", from: `***${from.slice(-4)}`, textLength: text.length });
  const supabase = createAdminClient();
  const appUrl = getAppUrl();
  const { sendWhatsAppProductCarousel } = await import("@/lib/whatsapp");
  const customerContext = await getCustomerFromWhatsApp(from);
  // Basic order lookup detection
  const orderMatch = /(?:order\s*#?:?\s*)([A-Z0-9\-]+)/i.exec(text);
  let orderInfo = null;

  if (orderMatch) {
    const orderNumber = orderMatch[1];
    const { data: order } = await supabase.from("orders").select("id, order_number, order_status, total, customer_name").eq("order_number", orderNumber).maybeSingle();
    if (order) orderInfo = order;
  }

  // Conversational shopping intent detection
  const shoppingMatch = /(?:show|find|looking for|search|browse)\s+(.*)/i.exec(text);
  if (shoppingMatch && shoppingMatch[1]) {
    const q = shoppingMatch[1].trim();
    const { data: products } = await supabase.from("products").select("id, title, price, images, slug").ilike("title", `%${q}%`).limit(6);
    const env = getWhatsAppServerEnv();
    const phone = formatWhatsAppPhone(from);
    if (phone && Array.isArray(products) && products.length > 0) {
      const items = (products as any[]).map((p) => ({ title: p.title, price: Number(p.price || 0), imageUrl: (p.images && p.images[0]) || `${appUrl}/placeholder-product.svg`, link: `${appUrl}/product/${p.slug}` }));
      await sendWhatsAppProductCarousel({ to: phone, products: items, token: env.WHATSAPP_CLOUD_API_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, caption: `Here are the best matches for "${q}"` });
      return { action: "carousel_sent", count: items.length };
    }
  }

  let prompt = `User: ${text}\n`;
  if (orderInfo) {
    prompt += `Order found: ${orderInfo.order_number}, status: ${orderInfo.order_status}, total: Rs.${orderInfo.total}. Provide a concise premium concierge reply and the next best action for refund, cancellation, payment, or delivery.`;
  } else if (customerContext) {
    const activeOrders = customerContext.activeOrders
      .map((order) => `#${order.orderNumber}: ${order.orderStatus}, ${order.paymentStatus}, Rs.${order.total}`)
      .join("; ") || "none";
    const pendingPayments = customerContext.pendingPayments
      .map((order) => `#${order.orderNumber}: ${order.paymentStatus}, Rs.${order.total}`)
      .join("; ") || "none";
    prompt += [
      `Customer resolved from WhatsApp phone.`,
      `Name: ${customerContext.name ?? "Customer"}`,
      `Active orders: ${activeOrders}`,
      `Cart: ${customerContext.cartItemCount} items, Rs.${customerContext.cartTotal}`,
      `Pending payments: ${pendingPayments}`,
      `Cancelled orders: ${customerContext.cancelledOrders.length}`,
      `Answer using this retrieved context. Do not ask for login, account creation, password, username, manual order search, or website visit.`,
    ].join("\n");
  } else {
    prompt += `Context unavailable. Reply only: "I couldn't retrieve your account data right now. Please share your order number."`;
  }

  const reply = await callOpenAISystem(prompt);

  // Send reply via WhatsApp
  const env = getWhatsAppServerEnv();
  const phone = formatWhatsAppPhone(from);
  if (!phone) throw new Error("Invalid phone number to reply to");

  await sendWhatsAppTextMessage({ to: phone, text: reply, token: env.WHATSAPP_CLOUD_API_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID });
  trace("MESSAGE_SENT", { handler: "legacy_support.ts", phoneSuffix: phone.slice(-4), replyLength: reply.length });
  trace("COMPLETE", { handler: "legacy_support.ts", action: "reply_sent" });

  return { reply };
}

export async function handleWebChatMessage({ userId, message }: { userId?: string; message: string }) {
  const supabase = createAdminClient();
  let profile: { email?: string | null; name?: string | null; phone?: string | null } | null = null;
  let recentOrders = "";

  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, name, phone")
      .eq("id", userId)
      .maybeSingle();
    profile = data;

    const { data: orders } = await supabase
      .from("orders")
      .select("order_number, order_status, payment_status, total, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (orders?.length) {
      recentOrders = orders
        .map(
          (order) =>
            `${order.order_number}: ${order.order_status}/${order.payment_status}, Rs.${order.total}`
        )
        .join("; ");
    }
  }

  const identity = profile
    ? `${profile.name ?? "Customer"} (${profile.email ?? profile.phone ?? "logged in"})`
    : "Guest shopper";

  const prompt = [
    `Customer: ${identity}`,
    recentOrders ? `Recent orders: ${recentOrders}` : "Recent orders: none on file for this account.",
    `Question: ${message}`,
    "Answer as Vrixo Concierge with concise, premium guidance about orders, delivery, returns, payments, and product help."
  ].join("\n");

  const reply = await callOpenAISystem(prompt);
  return { reply };
}
