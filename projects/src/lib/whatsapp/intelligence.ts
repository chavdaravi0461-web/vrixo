import "server-only";

import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import { formatWhatsAppPhone, getWhatsAppServerEnv } from "@/lib/whatsapp";
import {
  sendWhatsAppTextMessage,
  sendWhatsAppImageMessage,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppListMessage,
  type InteractiveButton,
  type ListSection,
} from "@/lib/whatsapp";
import { withRedis } from "@/lib/redis";
import { whatsappLog } from "@/lib/whatsapp/logger";
import {
  getCustomerFromWhatsApp,
  getCustomerOrders,
  getOrderByNumber,
  cancelCustomerOrder,
  type CustomerContext,
  type CustomerOrderDetailed,
} from "@/lib/whatsapp/customer-context";
import {
  buildOrderListMessage,
  buildOrderCard,
  buildOrderCardWithImage,
  buildCancellableOrdersMessage,
  buildCancellationConfirmation,
  buildCancellationFailed,
  buildOrderNotFound,
  buildCustomerProfileSummary,
} from "@/lib/whatsapp/order-display";
import type { ProductContext } from "@/lib/ai/provider";
import { runWithDebugReport, getDebugReport, printDebugReport } from "@/lib/whatsapp/debug-report";

function trace(event: string, details?: Record<string, unknown>) {
  console.log(`[TRACE] ${event}`, details ?? {});
}

export type WhatsAppIntent =
  | "greeting"
  | "order_status"
  | "refund"
  | "cod"
  | "cancel"
  | "payment_issue"
  | "delivery"
  | "shipping"
  | "invoice"
  | "address"
  | "cart"
  | "checkout"
  | "coupon"
  | "recommend"
  | "exchange"
  | "browse"
  | "my_number"
  | "my_data"
  | "whatsapp_escalate"
  | "unknown";

export type EmotionLevel = "neutral" | "frustrated" | "urgent" | "happy" | "confused";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type ProcessResult = {
  handled: boolean;
  action: string;
  replySent: boolean;
  intent: WhatsAppIntent;
  emotion: EmotionLevel;
  context: "ai" | "template";
};

const FRUSTRATION_WORDS = /(?:frustrated|annoying|worst|terrible|awful|useless|hopeless|fed up|sick of|angry|not happy|unhappy|pathetic|shameful)/i;
const URGENCY_WORDS = /(?:urgent|immediately|asap|right now|hurry|fast|quick|soon|today|now|emergency)/i;
const HAPPY_WORDS = /(?:love|amazing|great|fantastic|excellent|thanks|thank you|awesome|beautiful|perfect|wonderful)/i;
const CONFUSION_WORDS = /(?:confused|don't understand|how.*works|what.*mean|not sure|unsure|clarify)/i;
const VRIXO_DOMAIN_WORDS = /(?:vrixo|order|track|tracking|delivery|refund|return|payment|pay|cancel|shipping|invoice|address|cart|checkout|cod|coupon|discount|offer|product|watch|shoe|bag|accessor|shop|buy|purchase|price|size|exchange|support|help|status|kahan|kab|paise|rupay|upi|razorpay)/i;
const OUT_OF_DOMAIN_REPLY = "I handle Vrixo orders, products, payments, tracking, and shopping assistance. Please share your order number or tell me what you need regarding your Vrixo experience.";

export function detectIntent(text: string): WhatsAppIntent[] {
  const m = text.toLowerCase();
  const intents: WhatsAppIntent[] = [];

  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|hii|hlo|yo)\b/i.test(m.trim())) {
    intents.push("greeting");
  }
  if (/\b(order|track|status|kahan|where|delivery)\b.*\b(order|number|id|status|track)\b|\bmy\s*orders?\b|\border\s*batao\b|\border\s*ka\s*status\b|\borders?\s*ki\s*lis|\borders?\s*list\b|\bshow\s*purchases?\b|\bpurchase\s*history\b|\bkya\s*kharida\b|\bkitne\s*orders?\b|\border\s*history\b|\brecent\s*orders?\b|\blatest\s*orders?\b/i.test(m)) {
    intents.push("order_status");
  }
  if (/\blatest\b.*\border\b|\border\b.*\blatest\b|\brecent\b.*\border\b/i.test(m)) {
    intents.push("order_status");
  }
  if (/\b(refund|return|vapas|wapas|money\s*back|refund\s*karo|paise\s*vapas|paise\s*wapas)\b/i.test(m)) {
    intents.push("refund");
  }
  if (/\b(cod|cash\s*on\s*delivery|pay\s*on\s*delivery|payment\s*.*\bdelivery)\b/i.test(m)) {
    intents.push("cod");
  }
  if (/\b(cancel|cancelled|cancel\s*karo|band\s*karo|cancel\s*kar|mujhe\s*cancel|order\s*cancel|yeh\s*order\s*cancel|cancellation)\b/i.test(m)) {
    intents.push("cancel");
  }
  if (/\b(payment\s*fail|payment\s*issue|pay\s*.*\b(problem|not|didn)|transaction\s*failed|nahi\s*hua|money\s*not\s*deduct)\b/i.test(m)) {
    intents.push("payment_issue");
  }
  if (/\b(delivery|ship|shipped|dispatch|kab\s*tak|kahan|where\s*is|arrived|reach)\b/i.test(m)) {
    intents.push("delivery");
  }
  if (/\b(shipping|ship\s*charge|courier|dispatch)\b/i.test(m)) {
    intents.push("shipping");
  }
  if (/\b(invoice|bill|receipt|tax\s*invoice)\b/i.test(m)) {
    intents.push("invoice");
  }
  if (/\b(address|change\s*address|delivery\s*address|landmark|pincode)\b/i.test(m)) {
    intents.push("address");
  }
  if (/\b(cart|bag|basket|checkout\s*items)\b/i.test(m)) {
    intents.push("cart");
  }
  if (/\b(checkout|place\s*order|complete\s*order|buy\s*now)\b/i.test(m)) {
    intents.push("checkout");
  }
  if (/\b(coupon|discount|offer|promo|code|sale)\b/i.test(m)) {
    intents.push("coupon");
  }
  if (/\b(recommend|suggest|suggestion|kya\s*lu|best|top|luxury|premium|show\s*me|looking\s*for|find|search)\b.*\b(?:watch|shoe|bag|accessor|product|item)\b|\b(recommend|suggest|show)\b/i.test(m)) {
    intents.push("recommend");
  }
  if (/\b(browse|show|find|looking\s*for|search|see|view)\s+(.*)\b/i.test(m)) {
    intents.push("browse");
  }
  if (/\b(exchange|badal|replace|swap)\b/i.test(m)) {
    intents.push("exchange");
  }
  if (/\b(my\s*(phone|mobile|number|whatsapp)\s*(number)?|registered\s*number|what(\s*is)?\s*my\s*(mobile|phone|number))\b/i.test(m)) {
    intents.push("my_number");
  }
  if (/\b(my\s*(data|info|profile|account|details|summary|dashboard|kitna\s*kharida|total\s*purchase|spend|lifetime)|show\s*(my|full|all)?\s*(profile|data|info|account)|customer\s*profile|account\s*summary|vrixo\s*profile)\b/i.test(m)) {
    intents.push("my_data");
  }
  if (/\b(whatsapp|agent|human|talk|speak|baat\s*karo|call|phone)\b/i.test(m)) {
    intents.push("whatsapp_escalate");
  }

  if (intents.length === 0) intents.push("unknown");
  return intents;
}

export function analyzeEmotion(text: string): EmotionLevel {
  if (FRUSTRATION_WORDS.test(text)) return "frustrated";
  if (URGENCY_WORDS.test(text)) return "urgent";
  if (CONFUSION_WORDS.test(text)) return "confused";
  if (HAPPY_WORDS.test(text)) return "happy";
  return "neutral";
}

async function isDuplicate(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  const key = `whatsapp:dedup:${messageId}`;
  return withRedis(
    async (redis) => {
      const result = await (redis as any).set(key, "1", "NX", "EX", 300);
      return result === null;
    },
    false,
  );
}

async function isRateLimited(phone: string): Promise<boolean> {
  const key = `whatsapp:ratelimit:${phone}`;
  return withRedis(
    async (redis) => {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, 60);
      return current > 15;
    },
    false,
  );
}

async function getConversationHistory(phone: string): Promise<ConversationMessage[]> {
  trace("MEMORY_STARTED", { operation: "getConversationHistory", phone: `***${phone.slice(-4)}` });
  const key = `whatsapp:conversation:${phone}`;
  return withRedis(
    async (redis) => {
      const raw = await redis.get(key);
      if (!raw) return [];
      const messages = JSON.parse(raw) as ConversationMessage[];
      const cutoff = Date.now() - 3600_000;
      return messages.filter((m) => m.timestamp > cutoff).slice(-10);
    },
    [],
  );
}

async function saveConversationHistory(phone: string, messages: ConversationMessage[]): Promise<void> {
  trace("MEMORY_STARTED", { operation: "saveConversationHistory", phone: `***${phone.slice(-4)}` });
  const key = `whatsapp:conversation:${phone}`;
  await withRedis(
    async (redis) => {
      const recent = messages.slice(-20);
      await redis.set(key, JSON.stringify(recent), "EX", 3600);
      return true;
    },
    false,
  );
}

type TemplateResponseFn = (name: string, emotion: EmotionLevel, context?: CustomerContext | null) => string;
type TemplateResponseMap = Record<string, TemplateResponseFn>;

const ACCOUNT_CONTEXT_FALLBACK = "I couldn't retrieve your account data right now. Please share your order number.";

const TEMPLATE_RESPONSES: TemplateResponseMap = {
  greeting: (name, emotion, context) => {
    const firstName = (name ?? "").split(/\s+/)[0] || "";
    const ctx = context as CustomerContext | undefined;
    const activeCount = ctx?.activeOrders?.length ?? 0;
    const cartCount = ctx?.cartItemCount ?? 0;
    if (activeCount > 0 && cartCount > 0) {
      return `Namaste ${firstName}. You have ${activeCount} active order${activeCount > 1 ? "s" : ""} and ${cartCount} item${cartCount > 1 ? "s" : ""} in your cart. Orders, tracking, or checkout — what should I handle first?`;
    }
    if (activeCount > 0) {
      return `Namaste ${firstName}. You have ${activeCount} active order${activeCount > 1 ? "s" : ""}. Order details, tracking, or cancellation — what do you need?`;
    }
    if (cartCount > 0) {
      return `Namaste ${firstName}. ${cartCount} item${cartCount > 1 ? "s" : ""} waiting in your cart. Checkout or product advice — I am ready.`;
    }
    return `Namaste ${firstName}. Vrixo Concierge here — orders, tracking, products, payments, COD, returns, and cancellations. What brings you in today?`;
  },

  order_status: (name, emotion) => {
    const firstName = (name ?? "").split(/\s+/)[0] || "there";
    if (emotion === "frustrated" || emotion === "urgent") {
      return `${firstName}, I'm checking your orders right now. One moment please.`;
    }
    return `${firstName}, let me pull up your order information. Give me a moment.`;
  },

  refund: (_name, _emotion, context) => {
    const ctx = context as CustomerContext | undefined;
    if (ctx?.orders?.length) {
      return "I checked your orders. Tell me which item you want to return and I will guide the return eligibility and next step.";
    }
    return "Returns are available within 7 days of delivery for eligible items. I am checking your account details so I can guide the right next step.";
  },

  cod: () =>
    `Yes, we offer Cash on Delivery! Here's how it works:\n\n• Pay in cash when your order arrives\n• No upfront payment needed\n• ₹0 at the time of order\n• Your order stays "Pending" until Vrixo confirms it before dispatch\n\nYour order will only be dispatched after we confirm via WhatsApp. Ready to place one?`,

  cancel: (name) => {
    const firstName = (name ?? "").split(/\s+/)[0] || "there";
    return `${firstName}, I'm checking which of your orders can be cancelled. Give me a moment.`;
  },

  payment_issue: () =>
    `I can help with the payment issue.\n\n1. Try again with UPI / Card / Net Banking\n2. Switch to Cash on Delivery (COD)\n3. I can check pending payments linked to this WhatsApp number\n\nWhich option would you prefer?`,

  delivery: (_name, emotion, context) => {
    const ctx = context as CustomerContext | undefined;
    if (ctx?.activeOrders?.length) {
      const latest = ctx.activeOrders[0];
      return `I checked your active orders. Latest is #${latest.orderNumber} - ${latest.orderStatus}. I can help with tracking, cancellation eligibility, or delivery updates.`;
    }
    if (emotion === "frustrated") {
      return "I understand the delivery concern. I am checking your account details and will pull the latest order update from your WhatsApp number.";
    }
    return "I will help track your delivery. I am checking the orders linked to this WhatsApp number now.";
  },

  coupon: () =>
    "We have active offers across watches, shoes, casual, formal, and luxury. Share the category you are interested in and I will check the best available deal for you.",

  recommend: () =>
    `Premium watches, shoes, bags, and accessories available right now. Watches start at ₹1,999, shoes at ₹1,499, bags at ₹999. Style or budget — I will match you with the best picks.`,

  browse: () =>
    `Catalog search ready — watches, shoes, accessories. Type what you are looking for and I will pull matching products instantly.`,

  exchange: () =>
    "Exchanges are available within 7 days of delivery for eligible unused items. I am checking your account details so I can guide the correct order and item next.",

  my_number: (_name, _emotion, context) => {
    const ctx = context as CustomerContext | undefined;
    const phone = ctx?.phone;
    if (phone) {
      return `Your registered Vrixo number is +91${phone}, 91${phone}, or ${phone}.`;
    }
    return "I could not find a registered number linked to this WhatsApp account.";
  },

  whatsapp_escalate: () =>
    `I am with you. Order, tracking, payment, cancellation, return, or product — which one should I handle?`,

  unknown: (name, emotion, context) => {
    const firstName = (name ?? "").split(/\s+/)[0] || "";
    const ctx = context as CustomerContext | undefined;
    const hasOrders = (ctx?.orderCount ?? 0) > 0;
    const hasCart = (ctx?.cartItemCount ?? 0) > 0;
    if (emotion === "frustrated") {
      return `${firstName}, I understand. Share the details and I will resolve it.`;
    }
    if (hasOrders && hasCart) {
      return `${firstName}, you have orders to track and items in your cart. Orders, delivery, or checkout — which one?`;
    }
    if (hasOrders) {
      return `${firstName}, you have ${ctx?.orderCount ?? 0} order${(ctx?.orderCount ?? 0) > 1 ? "s" : ""} on your account. Order status, tracking, or returns — I am ready.`;
    }
    if (hasCart) {
      return `${firstName}, I see ${ctx?.cartItemCount ?? 0} item${(ctx?.cartItemCount ?? 0) > 1 ? "s" : ""} in your cart. Checkout or product questions — let me know.`;
    }
    return `Namaste ${firstName}. Vrixo Concierge — orders, tracking, products, payments, COD, returns, cancellations. What do you need?`;
  },
};

function getTemplateResponse(intent: WhatsAppIntent, name: string | null, emotion: EmotionLevel, context?: CustomerContext | null): string {
  const fn = TEMPLATE_RESPONSES[intent] ?? TEMPLATE_RESPONSES.unknown;
  return fn(name ?? "", emotion, context);
}

function isVrixoDomainRequest(text: string, intents: WhatsAppIntent[]): boolean {
  if (intents.some((intent) => intent !== "unknown")) return true;
  return VRIXO_DOMAIN_WORDS.test(text);
}

function formatOrderLine(order: CustomerOrderDetailed): string {
  const firstItem = order.items[0]?.title ?? "Order";
  return `Order #${order.orderNumber} - ${firstItem} - ${order.orderStatus}`;
}

function routeCustomerIntelligencePipeline(
  intents: WhatsAppIntent[],
  customerContext: CustomerContext,
): { reply: string; action: string } | null {
  const firstName = (customerContext.name ?? "").split(/\s+/)[0] || "there";

  if (intents.includes("delivery") || intents.includes("shipping")) {
    const active = customerContext.activeOrders;
    if (active.length === 0) {
      return {
        action: "delivery_no_active_orders",
        reply: `I checked your account, ${firstName}. There are no active delivery orders right now. I can help with products, checkout, returns, or past orders.`,
      };
    }
    if (active.length === 1) {
      const order = active[0];
      return {
        action: "delivery_single_order",
        reply: `I found your active order.\n\n${formatOrderLine(order)}\nPayment: ${order.paymentStatus}\n\nI can help with delivery updates, cancellation eligibility, or payment questions.`,
      };
    }
    return {
      action: "delivery_order_selection",
      reply: buildOrderListMessage(active, customerContext.name),
    };
  }

  if (intents.includes("payment_issue")) {
    const pending = customerContext.pendingPayments;
    if (pending.length === 0) {
      return {
        action: "payment_no_pending",
        reply: `I checked payments linked to your WhatsApp number, ${firstName}. I do not see any pending payment issue right now. I can still help with COD, checkout, or a specific active order.`,
      };
    }
    const lines = pending.map((order) => `- #${order.orderNumber} - ${order.paymentStatus} - Rs.${Math.round(order.total)}`);
    return {
      action: "payment_pending_list",
      reply: `I found ${pending.length} pending payment ${pending.length === 1 ? "order" : "orders"} linked to your account.\n\n${lines.join("\n")}\n\nWould you like to retry payment or switch to COD where available?`,
    };
  }

  if (intents.includes("refund") || intents.includes("exchange")) {
    const delivered = customerContext.orders.filter((order) => order.orderStatus === "delivered");
    if (delivered.length === 0) {
      return {
        action: "return_no_delivered_orders",
        reply: `I checked your orders, ${firstName}. I do not see a delivered order eligible for return or exchange right now. If an active order is still on the way, I can help track it.`,
      };
    }
    const lines = delivered.slice(0, 5).map((order) => `- #${order.orderNumber} - ${order.items[0]?.title ?? "Order"} - Delivered`);
    return {
      action: "return_order_selection",
      reply: `I found delivered orders linked to your account.\n\n${lines.join("\n")}\n\nWhich item would you like return or exchange help with?`,
    };
  }

  if (intents.includes("invoice")) {
    const orders = customerContext.orders;
    if (orders.length === 0) {
      return {
        action: "invoice_no_orders",
        reply: `I checked your account, ${firstName}. There are no orders linked yet, so there is no invoice available right now.`,
      };
    }
    if (orders.length === 1) {
      return {
        action: "invoice_single_order",
        reply: `I found one order for invoice help.\n\n${formatOrderLine(orders[0])}\n\nI can help prepare invoice support for this order.`,
      };
    }
    return {
      action: "invoice_order_selection",
      reply: buildOrderListMessage(orders, customerContext.name),
    };
  }

  if (intents.includes("address")) {
    const editable = customerContext.activeOrders.filter((order) => order.orderStatus === "pending" || order.orderStatus === "confirmed");
    if (editable.length === 0) {
      return {
        action: "address_no_editable_orders",
        reply: `I checked your active orders, ${firstName}. I do not see an order eligible for address changes right now. Address changes are safest before dispatch.`,
      };
    }
    const lines = editable.map((order) => `- #${order.orderNumber} - ${order.orderStatus}`);
    return {
      action: "address_order_selection",
      reply: `I found ${editable.length} order${editable.length === 1 ? "" : "s"} where address help may still be possible.\n\n${lines.join("\n")}\n\nWhich one should I handle?`,
    };
  }

  if (intents.includes("cart") || intents.includes("checkout")) {
    if (customerContext.cartItemCount === 0) {
      return {
        action: "cart_empty",
        reply: `I checked your cart, ${firstName}. It is empty right now. Tell me what you want to buy - watches, shoes, casual, formal, or luxury - and I will suggest options.`,
      };
    }
    const lines = customerContext.currentCart.slice(0, 5).map((item) => `- ${item.title} x${item.quantity} - Rs.${Math.round(item.price * item.quantity)}`);
    return {
      action: "cart_summary",
      reply: `I found ${customerContext.cartItemCount} item${customerContext.cartItemCount === 1 ? "" : "s"} in your cart.\n\n${lines.join("\n")}\n\nCart total: Rs.${Math.round(customerContext.cartTotal)}\nWould you like checkout or product help?`,
    };
  }

  if (intents.includes("cod")) {
    return {
      action: "cod_info",
      reply: "COD is available on eligible orders. You pay at delivery, and Vrixo confirms COD orders before dispatch. I can help you place a COD order or check COD status for an active order.",
    };
  }

  if (intents.includes("coupon")) {
    return {
      action: "coupon_help",
      reply: "Tell me what you are planning to buy - watches, shoes, casual, formal, or luxury - and I will suggest the best available option or offer.",
    };
  }

  if (intents.includes("my_data")) {
    return {
      action: "my_data_profile",
      reply: buildCustomerProfileSummary(customerContext),
    };
  }

  return null;
}

function buildCustomerContextForProvider(
  customerContext: CustomerContext | null,
): {
  isLoggedIn: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  orders: Array<{ orderNumber: string; orderStatus: string; paymentStatus: string; paymentMethod: string; total: number; createdAt: string; items: Array<{ title: string; quantity: number }> }>;
  currentCart: { itemCount: number; total: number; items: Array<{ title: string; price: number; quantity: number }> };
  customerSegment: string | null;
  ltv: number | null;
} | null {
  if (!customerContext) return null;
  return {
    isLoggedIn: true,
    name: customerContext.name,
    email: null,
    phone: customerContext.phone,
    orders: customerContext.orders.map((o) => ({
      orderNumber: o.orderNumber,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      total: o.total,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({ title: i.title, quantity: i.quantity })),
    })),
    currentCart: {
      itemCount: customerContext.cartItemCount,
      total: customerContext.cartTotal,
      items: customerContext.currentCart.map((i) => ({ title: i.title, price: i.price, quantity: i.quantity })),
    },
    customerSegment: customerContext.customerSegment,
    ltv: customerContext.ltv,
  };
}

async function generateAIResponse(
  userText: string,
  history: ConversationMessage[],
  customerContext: CustomerContext | null,
  intents: WhatsAppIntent[],
  emotion: EmotionLevel,
  intelligenceSummary?: string | null,
  products?: ProductContext | null,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  trace("AI_STARTED", {
    provider: "groq",
    hasGroqKey: Boolean(apiKey),
    model: process.env.GROQ_MODEL || "default",
  });
  if (!apiKey) {
    console.log("[INTELLIGENCE] AI_STARTED — GROQ_API_KEY not set, skipping AI");
    return null;
  }

  console.log("[INTELLIGENCE] AI_STARTED — Groq API key present, importing provider");
  try {
    const { generateCustomerChatResponse } = await import("@/lib/ai/provider");
    console.log("[INTELLIGENCE] AI_STARTED — provider imported successfully");

    const messages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userText },
    ];

    const customer = buildCustomerContextForProvider(customerContext);
    const emotionHint = emotion !== "neutral" ? `\n[Customer Emotion: ${emotion}]` : "";

    const cartHint = customerContext && customerContext.cartItemCount > 0
      ? `\n[Cart: ${customerContext.cartItemCount} items, ₹${customerContext.cartTotal}]`
      : "";
    const segmentHint = customerContext?.customerSegment
      ? `\n[Segment: ${customerContext.customerSegment}]`
      : "";
    const pendingHint = customerContext?.hasPendingPayments
      ? `\n[Pending Payments: ${customerContext.pendingPayments.length}]`
      : "";

    const augmentedText = `${userText}${emotionHint}${cartHint}${segmentHint}${pendingHint}\n[Detected Intents: ${intents.join(", ")}]`;
    messages[messages.length - 1] = { role: "user", content: augmentedText };

    console.log("[INTELLIGENCE] AI_STARTED — calling generateCustomerChatResponse with", {
      historyLen: history.length,
      hasCustomer: customer !== null,
      intents,
      emotion,
      cartCount: customerContext?.cartItemCount ?? 0,
      hasIntelligenceSummary: Boolean(intelligenceSummary),
      hasProducts: Boolean(products && products.length > 0),
    });

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const reply = await generateCustomerChatResponse(messages, customer, null, products, intelligenceSummary);
        if (reply) {
          trace("AI_SUCCESS", { replyLength: reply.length });
          console.log("[INTELLIGENCE] AI_SUCCESS — reply received", {
            replyLength: reply?.length ?? 0,
            replyPreview: reply ? `${reply.slice(0, 80)}...` : "EMPTY",
          });
          return reply || null;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          trace("AI_RETRY", { attempt });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    if (lastError) throw lastError;
    return null;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    trace("AI_FAILED", { error: errorMsg });
    console.log("[INTELLIGENCE] AI_FAILED — exception", { error: errorMsg, stack: errorStack });
    whatsappLog("warn", "intelligence.ai_failed", { error: errorMsg });
    return null;
  }
}

function makeRequestId(): string {
  return `vx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendCancellationNotification(
  phone: string | null,
  context: CustomerContext | null,
  orderNumber: string,
  whatsAppToken: string,
  whatsAppPhoneNumberId: string,
): Promise<void> {
  if (!phone || !context) return;
  const name = context.name ?? "Valued Customer";
  const firstName = name.split(/\s+/)[0];
  const order = context.orders.find((o) => o.orderNumber === orderNumber);
  const itemTitle = order?.items[0]?.title ?? "Order";
  const total = order?.total ?? 0;
  const refundNote = order?.paymentMethod === "cod"
    ? "No charges were made as this was a Cash on Delivery order."
    : `Your refund of ₹${Math.round(total)} will be processed within 3-5 business days.`;
  const message = [
    `╔══════════════════════════════╗`,
    `║  ✅ ORDER CANCELLED — VRIXO  ║`,
    `╚══════════════════════════════╝`,
    "",
    `Hi ${firstName},`,
    "",
    `Your order *${orderNumber}* has been cancelled successfully.`,
    "",
    `🛍 ${itemTitle}`,
    `💰 ₹${Math.round(total)}`,
    "",
    refundNote,
    "",
    "💎 *Vrixo Concierge* — Reply anytime for help.",
  ].join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendWhatsAppTextMessage({
        to: phone,
        text: message,
        token: whatsAppToken,
        phoneNumberId: whatsAppPhoneNumberId,
      });
      return;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function processWhatsAppMessage({
  from,
  text,
  messageId,
}: {
  from: string;
  text: string;
  messageId?: string;
}): Promise<ProcessResult> {
  const requestId = makeRequestId();

  return runWithDebugReport(requestId, async () => {
    const report = getDebugReport();
    report.incomingMessage = text ?? "";
    report.whatsappNumber = from ?? "";

    const startTime = Date.now();

    function checkpoint(event: string, details?: Record<string, unknown>) {
      const elapsed = Date.now() - startTime;
      console.log(`[${requestId}] ${event}`, { ...details, elapsedMs: elapsed });
      trace(event, { ...details, requestId, elapsedMs: elapsed });
    }

    checkpoint("WA-01_WEBHOOK_RECEIVED", {
      from: `***${(from ?? "").slice(-4)}`,
      textLength: (text ?? "").length,
      hasId: Boolean(messageId),
    });

    const result: ProcessResult = {
      handled: false,
      action: "none",
      replySent: false,
      intent: "unknown",
      emotion: "neutral",
      context: "template",
    };

    if (!text || !from) {
      checkpoint("WA-02_MESSAGE_EXTRACTED", { empty: true });
      result.action = "empty_message";
      report.failureStage = "empty_message";
      report.rootCause = `text="${text ?? ""}" from="${from ?? ""}"`;
      printDebugReport();
      return result;
    }

    if (messageId) {
      const duplicate = await isDuplicate(messageId);
      if (duplicate) {
        checkpoint("WA-02_MESSAGE_EXTRACTED", { duplicate: true, messageId });
        whatsappLog("info", "intelligence.duplicate_skipped", { messageId });
        result.action = "duplicate";
        report.failureStage = "duplicate";
        report.rootCause = `messageId=${messageId} already processed`;
        printDebugReport();
        return result;
      }
    }

    const intents = detectIntent(text);
    const emotion = analyzeEmotion(text);
    result.intent = intents[0] ?? "unknown";
    result.emotion = emotion;
    report.intent = result.intent;
    checkpoint("WA-07_INTENT_SELECTED", { intents, primaryIntent: result.intent, emotion });

    const env = getWhatsAppServerEnv();
    const phone = formatWhatsAppPhone(from);
    report.normalizedNumber = phone ?? "";
    const whatsAppToken = env.WHATSAPP_CLOUD_API_TOKEN;
    const whatsAppPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    checkpoint("WA-03_PHONE_NORMALIZED", { hasPhone: Boolean(phone), phoneSuffix: phone ? phone.slice(-4) : null });

    checkpoint("WA-04_CUSTOMER_LOOKUP_STARTED", {});
    const customerContext: CustomerContext | null = await getCustomerFromWhatsApp(from);
    if (customerContext) {
      report.customerLookup = "SUCCESS";
      report.customerId = customerContext.phone ?? null;
      report.ordersFound = customerContext.orderCount;
      report.latestOrder = customerContext.orders[0]?.orderNumber ?? null;
      report.userId = customerContext.userId;
      report.userLookup = customerContext.userId ? "SUCCESS" : "FAILED";
    } else {
      report.customerLookup = "FAILED";
      report.diag("getCustomerFromWhatsApp returned null — see customer context trace for exact reason");
    }
    console.log("[INTELLIGENCE] WA-05_CUSTOMER_RESOLVED", {
      fromSuffix: from?.slice(-4),
      phoneSuffix: phone?.slice(-4),
      found: customerContext !== null,
      orderCount: customerContext?.orderCount ?? 0,
      hasOrders: (customerContext?.orders?.length ?? 0) > 0,
      name: customerContext?.name ?? null,
      userId: customerContext?.userId ? `${customerContext.userId.slice(0, 8)}...` : null,
      cartCount: customerContext?.cartItemCount ?? 0,
    });
    checkpoint("WA-05_CUSTOMER_RESOLVED", {
      found: customerContext !== null,
      orderCount: customerContext?.orderCount ?? 0,
      activeOrders: customerContext?.activeOrders.length ?? 0,
      name: customerContext?.name ?? null,
      cartCount: customerContext?.cartItemCount ?? 0,
      hasPendingPayments: customerContext?.hasPendingPayments ?? false,
      customerSegment: customerContext?.customerSegment ?? null,
    });

    const { loadOrderIntelligenceContext, buildContextSummary } = await import("@/lib/order-intelligence/context-loader");
    const { recordQuestion } = await import("@/lib/order-intelligence/commerce-memory");
    const intelCtx = customerContext ? await loadOrderIntelligenceContext(from) : null;
    const intelSummary = intelCtx ? buildContextSummary(intelCtx) : null;
    const productsForAI = intelCtx?.productCatalog && intelCtx.productCatalog.length > 0
      ? intelCtx.productCatalog.map((p) => ({ id: p.id, title: p.title, price: p.price, category: p.category, image: p.image }))
      : null;
    checkpoint("WA-06_CONTEXT_LOADED", {
      hasIntelSummary: Boolean(intelSummary),
      hasProducts: Boolean(productsForAI && productsForAI.length > 0),
      intelOrderCount: intelCtx?.customer?.orders?.length ?? 0,
      intelCancellableCount: intelCtx?.cancellableOrders?.length ?? 0,
      intelDeliveryCount: intelCtx?.deliveryTracking?.length ?? 0,
      intelSupportCount: intelCtx?.supportHistory?.length ?? 0,
    });

    report.supportRoute = "support execution layer (template + AI pipeline)";

    if (customerContext) {
      report.contextBuilder = "SUCCESS";
      // Safety net: if customer's latest order was just created (within 5 min) and
      // whatsapp confirmation wasn't sent, try to send it now
      const latestOrder = customerContext.orders[0];
      if (latestOrder && phone && whatsAppToken && whatsAppPhoneNumberId) {
        const orderAge = Date.now() - new Date(latestOrder.createdAt).getTime();
        if (orderAge < 300_000 && orderAge >= 0) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            if (supabase) {
              const { data: ws } = await supabase
                .from("orders")
                .select("whatsapp_status, order_status, id, user_id, customer_name, total, items, payment_method, payment_status")
                .eq("order_number", latestOrder.orderNumber)
                .maybeSingle();
              if (ws && ws.whatsapp_status !== "sent") {
                const { dispatchOrderConfirmationWhatsApp } = await import("@/services/notifications/order-whatsapp");
                const item = (Array.isArray(ws.items) && ws.items[0]) as Record<string, unknown> | undefined;
                const productNames = Array.isArray(ws.items)
                  ? ws.items.map((i: Record<string, unknown>) => String(i.title ?? "")).filter(Boolean).join(", ")
                  : "Vrixo product";
                const totalQty = Array.isArray(ws.items)
                  ? ws.items.reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.quantity ?? 1), 0)
                  : 1;
                dispatchOrderConfirmationWhatsApp({
                  orderId: ws.id as string,
                  userId: ws.user_id as string | undefined,
                  customerName: (ws.customer_name as string) ?? customerContext.name ?? "",
                  customerPhone: customerContext.phone ?? "",
                  orderNumber: latestOrder.orderNumber,
                  productNames,
                  totalQty: Number(totalQty),
                  totalAmount: Number(ws.total ?? 0),
                  orderStatus: (ws.order_status as string) ?? "confirmed",
                  paymentMethod: (ws.payment_method as "cod" | "online") ?? "online",
                  paymentStatus: (ws.payment_status as string) ?? "paid",
                  productImageUrl: "",
                  deliveryAddress: "",
                }, { force: true }).catch(() => {});
              }
            }
          } catch {
            // non-blocking — don't fail the message flow
          }
        }
      }
    } else {
      report.contextBuilder = "FAILED";
      report.diag("customerContext is null — AI will be used without order context, or template fallback will fire");
    }

    const rateLimited = customerContext ? await isRateLimited(from) : false;
    if (rateLimited) {
      report.handler = "rate_limited";
      report.execution = "FAILED";
      report.failureStage = "rate_limit";
      report.rootCause = `customer ${from} exceeded 15 messages/60s rate limit`;
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "rate_limited" });
      printDebugReport();
      try {
        if (phone) {
          await sendWhatsAppTextMessage({
            to: phone,
            text: "I couldn't retrieve your account data right now. Please share your order number.",
            token: whatsAppToken,
            phoneNumberId: whatsAppPhoneNumberId,
          });
          result.replySent = true;
        }
      } catch {}
      result.action = "rate_limited";
      return result;
    }

    const history = await getConversationHistory(from);
    checkpoint("WA-02_MESSAGE_EXTRACTED", { historyLength: history.length });

    if (history.length > 0 && result.intent === "greeting") {
      // Session continuity: skip repeated greeting, let handlers use existing context
      checkpoint("SESSION_CONTINUITY", { action: "suppress_greeting", historyLength: history.length });
      const greetingIdx = intents.indexOf("greeting");
      if (greetingIdx >= 0) {
        intents.splice(greetingIdx, 1);
        if (intents.length === 0) intents.push("unknown");
      }
      result.intent = intents[0] ?? "unknown";
      report.intent = result.intent;
    }

    let reply: string | null = null;

    if (!isVrixoDomainRequest(text, intents)) {
      report.handler = "domain_redirect";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "domain_redirect" });
      reply = OUT_OF_DOMAIN_REPLY;
      result.action = "domain_redirect";
      result.context = "template";
      report.diag(`Out-of-domain request: text="${text.slice(0, 100)}"`);
    }

    if (!reply && result.intent === "browse") {
      report.handler = "browse_carousel";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "browse_carousel" });
      console.log("[INTELLIGENCE] PROCESSOR_SELECTED — browse intent, searching products");
      const { sendWhatsAppProductCarousel } = await import("@/lib/whatsapp");
      const q = text.replace(/(?:show|find|looking for|search|browse|see|view)\s+/i, "").trim();
      if (q) {
        const supabase = tryCreateAdminClient();
        if (!supabase) {
          console.log("[INTELLIGENCE] BROWSE — DB unavailable, falling through");
          report.diag("browse: supabase client returned null — DB unavailable");
        } else {
          let products: unknown = null;
          try {
            const { data } = await supabase
              .from("products")
              .select("id, title, price, images, slug")
              .ilike("title", `%${q}%`)
              .limit(6);
            products = data;
          } catch {
            console.log("[INTELLIGENCE] BROWSE — DB query failed, falling through");
            report.diag(`browse: DB query failed for query="${q}"`);
          }
          if (phone && Array.isArray(products) && products.length > 0) {
            const items = products.map((p: Record<string, unknown>) => ({
              title: String(p.title ?? ""),
              price: Number(p.price || 0),
              imageUrl:
                (Array.isArray(p.images) && p.images[0]) ||
                `${process.env.NEXT_PUBLIC_APP_URL || "https://www.vrixo.in"}/placeholder-product.svg`,
              link: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.vrixo.in"}/product/${p.slug}`,
            }));
            console.log("[INTELLIGENCE] PROCESSOR_SELECTED — sending carousel with", { count: items.length });
            report.diag(`browse: found ${items.length} products for query="${q}"`);
            printDebugReport();
            await sendWhatsAppProductCarousel({
              to: phone,
              products: items,
              token: whatsAppToken,
              phoneNumberId: whatsAppPhoneNumberId,
              caption: `Here are the best matches —`,
            });
            result.replySent = true;
            result.action = "carousel_sent";
            result.handled = true;
            result.context = "template";
            console.log("[INTELLIGENCE] MESSAGE_SENT — carousel sent");
          } else {
            console.log("[INTELLIGENCE] PROCESSOR_SELECTED — no products found for browse, falling through to AI");
            report.diag(`browse: no products found for query="${q}" — falling through`);
          }
        }
      }
    }

    const explicitOrderMatch = text.match(/#?([A-Z0-9-]{8,})/i);

    if (!reply && !result.replySent && !customerContext) {
      checkpoint("WA-05_CUSTOMER_RESOLVED", { found: false, handler: "context_unavailable_skip_order_blocks" });
      report.diag("customerContext is null — all order-specific blocks will be skipped, falling to AI/template");
    }

    if (!reply && !result.replySent && customerContext) {
      report.handler = "intelligence_pipeline";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "intelligence_pipeline", intents });
      const routed = routeCustomerIntelligencePipeline(intents, customerContext);
      if (routed) {
        reply = routed.reply;
        result.action = routed.action;
        result.context = "template";
      }
    }

    if (!reply && !result.replySent && result.intent === "order_status" && !explicitOrderMatch) {
      report.handler = "order_status_list";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "order_status_list" });
      const orders = customerContext?.orders ?? [];
      if (orders.length > 0) {
        const firstName = customerContext?.name ?? null;
        reply = buildOrderListMessage(orders, firstName);
        result.context = "template";
        result.action = "order_list";
        console.log("[INTELLIGENCE] ORDER_STATUS — built order list", { count: orders.length });
      } else {
        reply = buildOrderListMessage([], customerContext?.name ?? null);
        result.context = "template";
        result.action = "order_list_empty";
        console.log("[INTELLIGENCE] ORDER_STATUS — no orders found");
      }
    }

    if (!reply && !result.replySent && result.intent === "cancel") {
      report.handler = "cancel_handler";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "cancel" });
      const cancellable = (customerContext?.orders ?? []).filter((o) => o.isCancellable);
      if (cancellable.length === 1) {
        const order = cancellable[0];
        const cancelResult = await cancelCustomerOrder(order.orderNumber, from, "Cancelled via WhatsApp");
        if (cancelResult.success && cancelResult.order) {
          reply = buildCancellationConfirmation(cancelResult.order);
          result.context = "template";
          result.action = "order_cancelled";
          const { recordOrderDiscussed, recordIssue } = await import("@/lib/order-intelligence/commerce-memory");
          await recordOrderDiscussed(from, order.orderNumber);
          await recordIssue(from, `Cancelled order #${order.orderNumber}`);
          console.log("[INTELLIGENCE] CANCEL — auto-cancelled single eligible order", { orderNumber: order.orderNumber });
          await sendCancellationNotification(phone, customerContext, order.orderNumber, whatsAppToken, whatsAppPhoneNumberId);
        } else {
          reply = buildCancellationFailed(order.orderNumber, cancelResult.error ?? "Unknown error");
          result.context = "template";
          result.action = "cancel_failed";
          report.diag(`cancel failed: ${cancelResult.error ?? "unknown"}`);
        }
      } else if (cancellable.length > 1) {
        if (phone) {
          try {
            const rows: ListSection[] = [{
              title: "Cancellable Orders",
              rows: cancellable.map((o) => ({
                id: `cancel_${o.orderNumber}`,
                title: `#${o.orderNumber}`,
                description: `${o.items[0]?.title ?? "Order"} — ₹${Math.round(o.total)}`,
              })),
            }];
            await sendWhatsAppListMessage({
              to: phone,
              text: `I can help with that. I found ${cancellable.length} eligible orders for cancellation. Which one would you like to cancel?`,
              buttonText: "Select order to cancel",
              sections: rows,
              token: whatsAppToken,
              phoneNumberId: whatsAppPhoneNumberId,
              header: "Cancel Order",
              footer: "Vrixo Commerce",
            });
            result.replySent = true;
            result.action = "cancel_list_interactive";
            result.context = "template";
            console.log("[INTELLIGENCE] CANCEL — sent interactive list", { count: cancellable.length });
          } catch {
            reply = buildCancellableOrdersMessage(cancellable, customerContext?.name ?? null);
            result.context = "template";
            result.action = "cancel_eligibility_list";
            console.log("[INTELLIGENCE] CANCEL — list message failed, sent text fallback");
          }
        } else {
          reply = buildCancellableOrdersMessage(cancellable, customerContext?.name ?? null);
          result.context = "template";
          result.action = "cancel_eligibility_list";
          console.log("[INTELLIGENCE] CANCEL — showing eligible orders", { count: cancellable.length });
        }
      } else {
        reply = "I checked your orders. None are eligible for cancellation right now because cancellation is available only before dispatch for Pending or Confirmed orders. If your order is already shipped, I can help you with return options after delivery.";
        result.context = "template";
        result.action = "cancel_no_eligible";
        console.log("[INTELLIGENCE] CANCEL — no eligible orders");
      }
    }

    if (!reply && !result.replySent && result.intent === "order_status") {
      report.handler = "order_status_explicit";
      report.diag(`explicitOrderMatch=${explicitOrderMatch?.[0] ?? "null"}`);
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "order_status_explicit", hasExplicitOrder: Boolean(explicitOrderMatch) });
      const orderMatch = explicitOrderMatch;
      if (orderMatch) {
        const orderNumber = orderMatch[1].toUpperCase();
        const order = customerContext?.orders.find((o) => o.orderNumber === orderNumber);
        if (order) {
          const card = buildOrderCardWithImage(order);
          reply = card.caption;
          if (card.imageUrl && phone) {
            try {
              await sendWhatsAppImageMessage({
                to: phone,
                caption: card.caption,
                imageUrl: card.imageUrl,
                token: whatsAppToken,
                phoneNumberId: whatsAppPhoneNumberId,
              });
              result.replySent = true;
              result.action = "order_detail_with_image";
              console.log("[INTELLIGENCE] ORDER_STATUS — sent order detail with image", { orderNumber });
            } catch {
              console.log("[INTELLIGENCE] ORDER_STATUS — image send failed, falling back to text");
              report.diag(`image send failed for order #${orderNumber}`);
            }
          }
        } else {
          reply = buildOrderNotFound(orderNumber);
          result.context = "template";
          result.action = "order_not_found";
          report.diag(`order #${orderNumber} not found in customer context — phone mismatch or wrong order number`);
        }
      }
    }

    if (!reply && !result.replySent && result.intent === "cancel") {
      report.handler = "cancel_explicit";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "cancel_explicit", hasExplicitOrder: Boolean(explicitOrderMatch) });
      const orderMatch = explicitOrderMatch;
      if (orderMatch) {
        const orderNumber = orderMatch[1].toUpperCase();
        const cancelResult = await cancelCustomerOrder(orderNumber, from, "Cancelled via WhatsApp");
        if (cancelResult.success && cancelResult.order) {
          reply = buildCancellationConfirmation(cancelResult.order);
          result.context = "template";
          result.action = "order_cancelled";
          const { recordOrderDiscussed, recordIssue } = await import("@/lib/order-intelligence/commerce-memory");
          await recordOrderDiscussed(from, orderNumber);
          await recordIssue(from, `Cancelled order #${orderNumber}`);
          console.log("[INTELLIGENCE] CANCEL — order cancelled", { orderNumber });
          await sendCancellationNotification(phone, customerContext, orderNumber, whatsAppToken, whatsAppPhoneNumberId);
        } else {
          reply = buildCancellationFailed(orderNumber, cancelResult.error ?? "Unknown error");
          result.context = "template";
          result.action = "cancel_failed";
          report.diag(`cancel explicit failed for order #${orderNumber}: ${cancelResult.error ?? "unknown"}`);
          console.log("[INTELLIGENCE] CANCEL — failed", { orderNumber, error: cancelResult.error });
        }
      }
    }

    if (!reply && !result.replySent) {
      report.handler = "ai_response";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "ai_response" });
      console.log("[INTELLIGENCE] AI_STARTED — calling generateAIResponse");
      await recordQuestion(from, text).catch(() => {});
      reply = await generateAIResponse(text, history, customerContext, intents, emotion, intelSummary, productsForAI);
      if (reply) {
        checkpoint("WA-09_RESPONSE_GENERATED", { source: "ai", replyLength: reply.length });
        result.context = "ai";
        report.diag("AI response generated successfully — this is the legacy AI path");
        report.diag("WARNING: Legacy route detected — no template or order-specific handler matched");
      } else {
        checkpoint("WA-09_RESPONSE_GENERATED", { source: "ai", failed: true });
        report.diag("AI returned null — will fall back to template");
      }
    }

    if (!reply && !result.replySent) {
      report.handler = "template_fallback";
      checkpoint("WA-08_HANDLER_SELECTED", { handler: "template_fallback" });
      checkpoint("WA-09_RESPONSE_GENERATED", { source: "template", intent: result.intent, emotion });
      reply = getTemplateResponse(result.intent, customerContext?.name ?? null, emotion, customerContext);
      result.context = "template";
      console.log("[INTELLIGENCE] FALLBACK_USED — template generated", { replyPreview: `${reply.slice(0, 80)}...` });
    }

    printDebugReport();

    if (reply && !result.replySent) {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (!phone) throw new Error("Invalid phone");
          if (attempt > 0) {
            checkpoint("WA-10_RESPONSE_RETRY", { attempt, maxAttempts: 3 });
          }
          console.log("[INTELLIGENCE] MESSAGE_SENT — sending via WhatsApp Cloud API", {
            replyLength: reply.length,
            replyPreview: `${reply.slice(0, 80)}...`,
            phoneSuffix: phone.slice(-4),
            attempt: attempt + 1,
          });
          await sendWhatsAppTextMessage({
            to: phone,
            text: reply,
            token: whatsAppToken,
            phoneNumberId: whatsAppPhoneNumberId,
          });
          result.replySent = true;
          if (result.action === "none") result.action = "reply_sent";
          result.handled = true;
          checkpoint("WA-10_RESPONSE_DELIVERED", { success: true, replyLength: reply.length, attempt: attempt + 1 });
          break;
        } catch (err) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          checkpoint("WA-10_RESPONSE_DELIVERED", { success: false, error: errMsg, attempt: attempt + 1 });
          report.diag(`send attempt ${attempt + 1}/3 failed: ${errMsg}`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }
      if (!result.replySent) {
        report.execution = "FAILED";
        report.failureStage = "send_response";
        report.rootCause = `all 3 send attempts failed — last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`;
        whatsappLog("error", "intelligence.send_failed", {
          error: lastError instanceof Error ? lastError.message : String(lastError),
          attempts: 3,
        });
        result.action = "send_failed";
      }
    }

    const totalDuration = Date.now() - startTime;
    const newHistory: ConversationMessage[] = [
      ...history,
      { role: "user", content: text, timestamp: Date.now() },
      { role: "assistant", content: reply ?? "", timestamp: Date.now() },
    ];
    await saveConversationHistory(from, newHistory);
    checkpoint("COMPLETE", {
      handled: result.handled,
      action: result.action,
      replySent: result.replySent,
      context: result.context,
      intent: result.intent,
      emotion: result.emotion,
      totalDurationMs: totalDuration,
    });

    console.log("ACTUAL CUSTOMER RESPONSE");
    return result;
  });
}
