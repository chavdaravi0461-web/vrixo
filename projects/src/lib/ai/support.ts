import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { getWhatsAppServerEnv, formatWhatsAppPhone } from "@/lib/whatsapp";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callOpenAISystem(prompt: string) {
  if (!OPENAI_API_KEY) {
    return [
      "Vrixo AI support is online, but live AI responses are not configured yet.",
      "For order help, share your order number on WhatsApp or email support@vrixo.in.",
      "For COD, your order stays pending until Vrixo confirms it before dispatch."
    ].join(" ");
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: "You are VRIXO AI customer support assistant. Reply concisely and professionally in user's language." }, { role: "user", content: prompt }],
    max_tokens: 350
  });

  return res.choices?.[0]?.message?.content ?? "";
}

export async function handleWhatsAppSupportMessage({ from, text }: { from: string; text: string }) {
  const supabase = createAdminClient();
  const appUrl = getAppUrl();
  const { sendWhatsAppProductCarousel } = await import("@/lib/whatsapp");
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
    prompt += `Order found: ${orderInfo.order_number}, status: ${orderInfo.order_status}, total: ₹${orderInfo.total}. Provide a concise helpful reply and next steps for refund or delivery.`;
  } else {
    prompt += `No explicit order found. Provide helpful shipping/refund/support guidance.`;
  }

  const reply = await callOpenAISystem(prompt);

  // Send reply via WhatsApp
  const env = getWhatsAppServerEnv();
  const phone = formatWhatsAppPhone(from);
  if (!phone) throw new Error("Invalid phone number to reply to");

  await sendWhatsAppTextMessage({ to: phone, text: reply, token: env.WHATSAPP_CLOUD_API_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID });

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
            `${order.order_number}: ${order.order_status}/${order.payment_status}, ₹${order.total}`
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
    "Answer with concise Vrixo support guidance about orders, delivery, returns, payments, and product help."
  ].join("\n");

  const reply = await callOpenAISystem(prompt);
  return { reply };
}
