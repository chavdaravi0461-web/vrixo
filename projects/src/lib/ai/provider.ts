import Groq from "groq-sdk";
import { withProtection } from "@/lib/dependency-protection";
import type { SupportContext, ExecutionResult, SupportIntent } from "@/lib/support/types";

const SYSTEM_PROMPT = `ROLE:
You are Vrixo Concierge OS — the customer identity system, luxury store manager, order intelligence layer, support operator, purchase assistant, post-purchase concierge, and recovery system for Vrixo. You are NOT ChatGPT and NOT a generic chatbot.

MISSION:
Resolution, not conversation. Deliver the fastest safe Vrixo resolution. The customer should feel: "I am talking to Vrixo itself, not an AI bot."

PERSONALITY:
- Professional, premium, confident, fast, human, and helpful.
- Never robotic, repetitive, generic, or FAQ-like.
- If the customer writes in Hindi or Hinglish, reply naturally in Hindi or Hinglish.
- Keep replies concise: usually 2-5 short lines.
- Never introduce yourself repeatedly, never restart conversations, never ask unnecessary questions.

IDENTITY FIRST:
- On WhatsApp, the phone number is the primary customer identity.
- Account/order/payment/cart/support context must be attached before answering whenever available.
- Generic AI is last. Orders, tracking, delivery, refunds, payments, cancellation, returns, shipping, invoice, address, cart, and checkout must be answered from retrieved Vrixo context.

CUSTOMER EXPERIENCE RULES:
- Use live customer data when provided. Reference exact order numbers, statuses, products, payments, totals, and tracking context.
- Never say you do not have access if data is present.
- Never invent order, payment, tracking, product, or policy details.
- Never ask for a password, OTP, UPI PIN, card CVV, username, or login.
- Never expose internal errors, model/provider names, stack traces, or implementation details.
- Never say "I don't know"; say what you checked and what the customer can do next.
- Do not repeat a greeting if the conversation already started.
- Do not send placeholder links.
- Do not behave like a generic support bot.

VRIXO DOMAIN LOCK:
- You exist only for Vrixo.
- Only answer Vrixo orders, products, tracking, payments, shipping, returns, cancellations, customer accounts, carts, coupons, support, recommendations, policies, checkout, and post-purchase support.
- If asked anything unrelated, redirect with: "I'm here to help with Vrixo orders, products, payments, tracking, support, and shopping assistance. How can I help with your Vrixo experience today?"
- Never answer coding, random knowledge, politics, mathematics, or unrelated discussions.

PRIORITY:
Resolve the issue first, reduce friction, increase trust, then sell where helpful.`;

const FORMAT_PROMPT = `ROLE:
You are the Vrixo response formatter. You do NOT make decisions. You do NOT check data. You receive structured execution results from the support engine and format them into natural, premium-sounding replies for the customer.

ABSOLUTE RULES:
- You ONLY format the EXECUTION RESULT provided. Never add information not in the result.
- Never decide what action to take. The execution engine already decided.
- Never say "Let me check", "I'm looking into", "How can I help today".
- Never invent orders, tracking, statuses, payments, or any data.
- Never ask the customer to log in, visit a website, or search for an order.
- If the customer writes in Hindi or Hinglish, format the reply in Hindi or Hinglish.
- Keep replies concise: usually 2-5 short lines.
- Never introduce yourself. Start with the result.
- Do not behave like ChatGPT. Be premium, confident, and direct.
- Only respond about Vrixo orders, products, tracking, payments, shipping, returns, cancellations, and shopping. Redirect unrelated questions.

Vrixo naming: Use order numbers like DC-260530-68DC5D (keep the format as-is).

EXECUTION RESULT FORMAT:
The execution result tells you what happened:
- action: "awaiting_confirmation" — destructive action. Present eligibility clearly and ask customer to reply YES to confirm. Format the confirmationDetails into the message.
- action: "executed" — the action was taken or is ready. Format the result naturally.
- action: "needs_selection" — multiple items found. List them and ask which one.
- action: "not_found" — nothing found. Say it clearly.
- action: "not_eligible" — the request can't be done. Say why.
- action: "error" — something went wrong. Apologize briefly and ask to retry.

EXAMPLES:

Input (cancel_order, awaiting_confirmation, order DC-260530-68DC5D, pending, eligible):
Output: "Found order DC-260530-68DC5D.
Status: Confirmed
Eligible: Yes

Reply YES to confirm cancellation."

Input (cancel_order, executed, order DC-260530-68DC5D, pending):
Output: "Order DC-260530-68DC5D has been cancelled successfully."

Input (cancel_order, needs_selection, 3 eligible orders):
Output: "I found 3 orders eligible for cancellation:
- DC-260530-68DC5D
- DC-260531-A1B2C3
- DC-260532-X9Y8Z7
Which one would you like to cancel?"

Input (cancel_order, not_eligible, order shipped):
Output: "Order DC-260530-68DC5D is already shipped and cannot be cancelled now."

Input (tracking, executed, order shipped, tracking number available):
Output: "Order DC-260530-68DC5D is shipped. Tracking ID: TRK123456. Expected delivery: 2-4 days."

Input (refund, executed, order delivered, Rs.1500):
Output: "Order DC-260530-68DC5D (Rs.1,500) is eligible for refund. A support agent will process it."

Input (order_status, executed, orders found):
Output: "I found 2 orders on your account:
- DC-260530-68DC5D — Shipped
- DC-260531-A1B2C3 — Delivered"

Input (order_status, not_found):
Output: "I couldn't retrieve your account data right now. Please share your order number."

DATA RETRIEVAL FAILURE:
If no customer data is available, say EXACTLY: "I couldn't retrieve your account data right now. Please share your order number."`;

type Message = { role: "system" | "user" | "assistant"; content: string };

const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "mixtral-8x7b-32768";

const AI_FALLBACK = "I couldn't retrieve your account data right now. Please share your order number.";

export async function generateAIResponse(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || PRIMARY_MODEL;

  if (!apiKey) {
    return "I couldn't retrieve your account data right now. Please share your order number.";
  }

  return withProtection("openai-api", async () => {
    try {
      const groq = new Groq({ apiKey });
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.5,
      });

      return String(response.choices?.[0]?.message?.content ?? "").trim();
    } catch (err) {
      console.error("[ai] generateAIResponse error:", err);
      throw err;
    }
  }, AI_FALLBACK);
}

export type CustomerContext = {
  isLoggedIn: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  orders: Array<{
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    total: number;
    createdAt: string;
    items: Array<{ title: string; quantity: number }>;
  }>;
  currentCart?: {
    itemCount: number;
    total: number;
    items: Array<{ title: string; price: number; quantity: number }>;
  };
  customerSegment?: string | null;
  ltv?: number | null;
};

export type AdminContext = {
  isAdmin: boolean;
  totalOrders?: number;
  totalRevenue?: number;
  topProducts?: Array<{ title: string; count: number }>;
};

export type ProductContext = Array<{
  id: string;
  title: string;
  price: number;
  category: string;
  image: string | null;
}>;

export async function generateCustomerChatResponse(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  customer: CustomerContext | null,
  admin?: AdminContext | null,
  products?: ProductContext | null,
  intelligenceSummary?: string | null,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  let systemPrompt = SYSTEM_PROMPT;

  // --- Customer context ---
  if (customer?.isLoggedIn) {
    const orderSummary =
      customer.orders.length > 0
        ? customer.orders
            .map(
              (o) => `ORDER #${o.orderNumber}
Status: ${o.orderStatus}
Payment: ${o.paymentStatus} (${o.paymentMethod})
Total: Rs.${o.total}
Date: ${o.createdAt}
Items: ${o.items.map((i) => `${i.title} x${i.quantity}`).join(", ")}`,
            )
            .join("\n---\n")
        : "NO ORDERS FOUND - Customer has no orders in their account.";

    systemPrompt += `

LIVE CUSTOMER DATA (REAL)
Name: ${customer.name ?? "Unknown"}
Email: ${customer.email ?? "Unknown"}
Phone: ${customer.phone ?? "Unknown"}
Cart: ${customer.currentCart ? `${customer.currentCart.itemCount} items, Rs.${customer.currentCart.total}` : "Unknown"}
Segment: ${customer.customerSegment ?? "Unknown"}
LTV: ${customer.ltv ?? "Unknown"}
Orders:
${orderSummary}
INSTRUCTIONS: Use this data to answer. Reference specific order numbers. If no orders, say that clearly. Never hallucinate.`;
  } else {
    systemPrompt += `

CUSTOMER CONTEXT UNAVAILABLE
Say EXACTLY: "I couldn't retrieve your account data right now. Please share your order number."
Do NOT say "I'm checking your account..." or "Let me look that up..."
For shopping, product recommendations, COD, shipping, and policy questions that do not need account data, help immediately.`;
  }

  // --- Admin context ---
  if (admin?.isAdmin) {
    systemPrompt += `

ADMIN ANALYTICS (REAL)
Total Orders: ${admin.totalOrders ?? "N/A"}
Total Revenue: Rs.${admin.totalRevenue?.toLocaleString("en-IN") ?? "N/A"}
Top Products: ${(admin.topProducts ?? []).map((p) => `${p.title} (${p.count} sold)`).join(", ") || "N/A"}
`;
  }

  // --- Product catalog context (for recommendations) ---
  if (products && products.length > 0) {
    systemPrompt += `

AVAILABLE PRODUCTS (for recommendations)
${products
  .map(
    (p) => `- ${p.title} - Rs.${p.price} (${p.category})`,
  )
  .join("\n")}

When someone asks for recommendations, suggest specific products from this list with prices.`;
  }

  // --- Order intelligence context (enriched with cancellations, tracking, support history) ---
  if (intelligenceSummary) {
    systemPrompt += `

ORDER INTELLIGENCE CONTEXT
${intelligenceSummary}
`;
  }

  const groq = new Groq({ apiKey });
  const fullMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  return withProtection("openai-api", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let attempt = 0;
    const models = [PRIMARY_MODEL, FALLBACK_MODEL];
    const lastError: string[] = [];

    while (attempt < models.length) {
      const model = models[attempt];
      try {
        const response = await groq.chat.completions.create(
          {
            model,
            messages: fullMessages,
            max_tokens: 512,
            temperature: 0.5,
          },
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        return String(response.choices?.[0]?.message?.content ?? "").trim();
      } catch (err: unknown) {
        clearTimeout(timeout);
        const msg = err instanceof Error ? err.message : String(err);
        lastError.push(`${model}: ${msg}`);
        console.warn(`[ai] model ${model} failed:`, msg);
        attempt++;
      }
    }

    clearTimeout(timeout);
    throw new Error(
      `All Groq models failed: ${lastError.join(" | ")}`,
    );
  }, AI_FALLBACK);
}

export async function* streamAIResponse(messages: Message[]) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    yield "I couldn't retrieve your account data right now. Please share your order number.";
    return;
  }

  const groq = new Groq({ apiKey });
  const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages] as Message[];

  let attempt = 0;
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  while (attempt < models.length) {
    const model = models[attempt];
    try {
      const stream = await groq.chat.completions.create({
        model,
        messages: fullMessages,
        max_tokens: 512,
        temperature: 0.5,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
      return;
    } catch (err) {
      console.warn(`Groq model ${model} failed:`, err);
      attempt++;
      if (attempt >= models.length) {
        yield "I couldn't retrieve your account data right now. Please share your order number.";
      }
    }
  }
}

export async function generateSupportFormattedResponse(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  ctx: SupportContext | null,
  executionResult: ExecutionResult,
  primaryIntent: SupportIntent,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return executionResult.message;
  }

  const customerBlock = ctx
    ? `CUSTOMER: ${ctx.customer.name ?? "Unknown"} (${ctx.customer.isLoggedIn ? ctx.customer.email ?? "logged in" : "guest"})
Orders on account: ${ctx.orderCount}
Active orders: ${ctx.activeOrders.length}
Cancelled: ${ctx.cancelledOrders.length}`
    : "CUSTOMER: Unknown (no context)";

  const needsSelectionBlock =
    executionResult.action === "needs_selection" && executionResult.eligibleOrders
      ? `\nELIGIBLE ORDERS (customer must pick one):\n${executionResult.eligibleOrders
          .map(
            (o, i) =>
              `${i + 1}. ${o.orderNumber} — ${o.orderStatus} — ${o.items[0]?.title ?? "N/A"} — Rs.${o.total}`,
          )
          .join("\n")}`
      : "";

  const systemPrompt = `${FORMAT_PROMPT}

EXECUTION RESULT TO FORMAT:
Intent: ${executionResult.intent}
Action: ${executionResult.action}
Message: ${executionResult.message}
Data: ${JSON.stringify(executionResult.data, null, 2)}
${needsSelectionBlock}

${customerBlock}

INSTRUCTIONS: Format the execution result above into a natural reply for the customer. Do NOT add any information not in the result. Do NOT take actions. Just format what is given.`;

  const groq = new Groq({ apiKey });
  const fullMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  return withProtection("openai-api", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let attempt = 0;
    const models = [PRIMARY_MODEL, FALLBACK_MODEL];

    while (attempt < models.length) {
      const model = models[attempt];
      try {
        const response = await groq.chat.completions.create(
          {
            model,
            messages: fullMessages,
            max_tokens: 512,
            temperature: 0.3,
          },
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        return String(response.choices?.[0]?.message?.content ?? "").trim();
      } catch (err: unknown) {
        clearTimeout(timeout);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ai] formatter model ${model} failed:`, msg);
        attempt++;
      }
    }

    clearTimeout(timeout);
    return executionResult.message;
  }, executionResult.message);
}
