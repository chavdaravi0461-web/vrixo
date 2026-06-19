import "server-only";

import { checkServerRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { buildSupportContext } from "@/lib/support/context-builder";
import { intentHandlers } from "@/lib/support/executor";
import { generateSupportFormattedResponse } from "@/lib/ai/provider";
import type { SupportIntent, ExecutionResult, PendingConfirmation, AuditEntry } from "@/lib/support/types";
import { runWithDebugReport, getDebugReport, printDebugReport } from "@/lib/whatsapp/debug-report";

const SESSION_TTL = 30 * 60 * 1000;
const CONFIRMATION_TTL = 5 * 60 * 1000;

interface Session {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  pendingConfirmation: PendingConfirmation | null;
  auditLog: AuditEntry[];
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function getSession(sessionId: string): Session {
  pruneSessions();
  const now = Date.now();
  const existing = sessions.get(sessionId);
  if (existing && existing.expiresAt > now) return existing;
  const session: Session = {
    messages: [],
    pendingConfirmation: null,
    auditLog: [],
    expiresAt: now + SESSION_TTL,
  };
  sessions.set(sessionId, session);
  return session;
}

let lastPruned = 0;
function pruneSessions() {
  const now = Date.now();
  if (now - lastPruned < 10 * 60 * 1000) return;
  lastPruned = now;
  for (const [key, s] of sessions) {
    if (s.expiresAt <= now) sessions.delete(key);
  }
}

function clearPendingConfirmation(session: Session): void {
  session.pendingConfirmation = null;
}

function isConfirmationMessage(m: string): boolean {
  const lower = m.toLowerCase().trim();
  return ["yes", "haan", "hmm", "ok", "okay", "confirm", "proceed", "do it", "cancel it", "cancel", "yeah", "yep", "ha", "ho jaye", "karo", "kar do"].includes(lower);
}

function isRejectionMessage(m: string): boolean {
  const lower = m.toLowerCase().trim();
  return ["no", "nahi", "cancel mat karo", "cancel nahi", "stop", "cancel request", "don't", "cancel nahi karna", "mat karo", "nahi karo", "no cancel", "no refund"].includes(lower);
}

function detectIntent(message: string): {
  primary: SupportIntent;
  all: string[];
  params: Record<string, unknown>;
} {
  const m = message.toLowerCase();
  const intents: string[] = [];
  const params: Record<string, unknown> = {};

  const orderMatch = m.match(/(?:order\s*#?:?\s*)([A-Z0-9\-]+)/i);
  if (orderMatch) params.orderNumber = orderMatch[1].toUpperCase();

  if (/my orders?|order status|track|kahan hai|order history/i.test(m)) intents.push("order_status");
  if (/latest|recent|last order/i.test(m)) intents.push("order_status");
  if (/refund|vapas|wapas|money back|paise wapas/i.test(m)) intents.push("refund");
  if (/return/i.test(m) && !/refund/i.test(m)) intents.push("return_order");
  if (/cod|cash on delivery|pay on delivery|payment.*delivery/i.test(m)) intents.push("cod_question");
  if (/cancel|cancelled|cancel kar|band kar/i.test(m)) intents.push("cancel_order");
  if (/payment fail|payment issue|pay.*problem|transaction|nahi hua|payment failed/i.test(m)) intents.push("payment_issue");
  if (/delivery|ship|shipped|dispatch|kahan|kab tak|tracking/i.test(m)) intents.push("tracking");
  if (/coupon|discount|offer|promo|code/i.test(m)) intents.push("product_question");
  if (/recommend|suggest|suggestion|kya lu\?|best|top|suggest/i.test(m)) intents.push("product_question");
  if (/exchange|badal|replace/i.test(m)) intents.push("replace_order");
  if (/agent|human|talk|speak|baat karo|representative|escalate/i.test(m)) intents.push("support_escalation");
  if (/admin|analytics|dashboard|total.*order|revenue|top.*product/i.test(m)) intents.push("support_escalation");
  if (intents.length === 0) intents.push("product_question");

  return { primary: intents[0] as SupportIntent, all: intents, params };
}

function appendAudit(session: Session, entry: AuditEntry): void {
  session.auditLog.push(entry);
  console.log("[AUDIT]", JSON.stringify(entry));
}

const QUICK_REPLIES_MAP: Record<string, string[]> = {
  order_status: ["My latest order", "Track my order", "Return an item"],
  cod_question: ["How does COD work?", "What if COD fails?"],
  payment_issue: ["Try again", "Switch to COD", "Payment help"],
  refund: ["Return policy", "Start a return", "Exchange instead"],
  return_order: ["Return policy", "Start a return"],
  tracking: ["Where is my order?", "Delivery ETA", "Change address"],
  product_question: ["Show me watches", "Show me shoes", "Under ₹2000", "Any offers?"],
  cancel_order: ["Cancel my order", "Can I cancel?"],
  replace_order: ["Exchange policy", "Start exchange"],
  support_escalation: ["Talk to agent", "Order help"],
  default: ["My orders", "Track delivery", "COD info", "Product help"],
};

export async function POST(request: Request) {
  return runWithDebugReport(`support-chat-${Date.now().toString(36)}`, async () => {
    const report = getDebugReport();
    const start = Date.now();

    const limited = await checkServerRateLimit(request, { key: "support-chat", limit: 20, windowMs: 60 * 1000 });
    if (!limited.allowed) {
      report.failureStage = "rate_limited";
      report.rootCause = "server rate limit exceeded (20 requests per 60s)";
      printDebugReport();
      console.log("ACTUAL CUSTOMER RESPONSE");
      return Response.json(
        { success: false, error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }

    const user = await getCurrentUser();

    try {
      let message = "";
      let sessionId = "";

      try {
        const body = (await request.json()) as Record<string, unknown>;
        if (typeof body.message === "string") message = body.message.trim();
        if (typeof body.sessionId === "string") sessionId = body.sessionId;
      } catch {
        report.failureStage = "invalid_json";
        report.rootCause = "request body is not valid JSON";
        printDebugReport();
        console.log("ACTUAL CUSTOMER RESPONSE");
        return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
      }

      if (!message) {
        report.failureStage = "empty_message";
        report.rootCause = "message field is empty or missing";
        printDebugReport();
        console.log("ACTUAL CUSTOMER RESPONSE");
        return Response.json({ success: false, error: "Message is required" }, { status: 400 });
      }

      if (message.length > 2000) {
        report.failureStage = "message_too_long";
        report.rootCause = `message length ${message.length} exceeds 2000 char limit`;
        printDebugReport();
        console.log("ACTUAL CUSTOMER RESPONSE");
        return Response.json({ success: false, error: "Message too long (max 2000 characters)" }, { status: 400 });
      }

      if (!sessionId) sessionId = crypto.randomUUID();

      const session = getSession(sessionId);

      report.incomingMessage = message;

    // ─── Stage 0: Check for pending confirmation ─────────────────────────────
    const pending = session.pendingConfirmation;
    const now = Date.now();

    if (pending && now > pending.expiresAt) {
      clearPendingConfirmation(session);
    }

    const isConfirm = isConfirmationMessage(message);
    const isReject = isRejectionMessage(message);

    if (pending && isConfirm) {
      session.messages.push({ role: "user", content: message });

      report.supportRoute = "support execution layer (web chat, confirmation)";
      report.intent = pending.intent;
      report.handler = `confirm:${pending.intent}`;
      report.diag(`pending confirmation found for intent=${pending.intent} order=${pending.orderNumber}`);

      const supportCtx = await buildSupportContext({
        userId: user?.id ?? null,
        phone: user?.phone ?? null,
      });

      if (!supportCtx) {
        clearPendingConfirmation(session);
        report.contextBuilder = "FAILED";
        report.customerLookup = "FAILED";
        report.failureStage = "buildSupportContext_null";
        report.rootCause = "buildSupportContext returned null — profile query or orders query failed silently";
        printDebugReport();
        const reply = "I couldn't retrieve your account data right now. Please share your order number.";
        session.messages.push({ role: "assistant", content: reply });
        console.log("ACTUAL CUSTOMER RESPONSE");
        return Response.json({ success: true, reply, quickReplies: QUICK_REPLIES_MAP.default, primaryIntent: pending.intent, intents: [pending.intent], executionResult: null });
      }
      report.contextBuilder = "SUCCESS";
      report.customerLookup = "SUCCESS";
      report.customerId = supportCtx.customer.phone ?? null;
      report.ordersFound = supportCtx.orderCount;
      report.latestOrder = supportCtx.orders[0]?.orderNumber ?? null;

      // Execute the confirmed action
      const handler = intentHandlers[pending.intent];
      let executionResult: ExecutionResult;

      try {
        executionResult = await handler(supportCtx, {
          orderNumber: pending.orderNumber,
          confirmed: true,
          ...pending.data,
        });
      } catch {
        executionResult = { intent: pending.intent, action: "error", data: {}, message: "Service unavailable. Please try again later.", error: "Handler threw" };
        report.execution = "FAILED";
        report.failureStage = "handler_threw";
        report.rootCause = `handler(${pending.intent}) threw an exception`;
      }

      clearPendingConfirmation(session);

      appendAudit(session, {
        timestamp: new Date().toISOString(),
        customerId: user?.id ?? null,
        customerPhone: supportCtx.customer.phone ?? null,
        sessionId,
        intent: pending.intent,
        action: executionResult.action,
        orderNumber: pending.orderNumber,
        beforeState: { pending_confirmation: pending },
        afterState: { execution_result: executionResult.action },
        success: executionResult.action === "executed",
        error: executionResult.error ?? null,
      });

      let reply: string;
      try {
        reply = await generateSupportFormattedResponse(
          session.messages.slice(-10),
          supportCtx,
          executionResult,
          pending.intent,
        );
      } catch {
        reply = executionResult.message;
        report.diag("AI formatting failed — used raw executionResult.message as reply");
      }

      session.messages.push({ role: "assistant", content: reply });

      console.log(`[support-chat] confirmed session=${sessionId.slice(0, 8)} intent=${pending.intent} order=${pending.orderNumber} action=${executionResult.action} dur=${Date.now() - start}ms`);

      report.diag(`confirmation executed — action=${executionResult.action}`);
      printDebugReport();

      const confirmQuickReplies = ["Check my orders", "Track delivery", "Need help"];
      console.log("ACTUAL CUSTOMER RESPONSE");
      return Response.json({ success: true, reply, quickReplies: confirmQuickReplies, primaryIntent: pending.intent, intents: [pending.intent], executionResult: { action: executionResult.action, message: executionResult.message, needsSelection: false } });
    }

    if (pending && isReject) {
      clearPendingConfirmation(session);
      session.messages.push({ role: "user", content: message });
      report.supportRoute = "support execution layer (web chat, rejection)";
      report.intent = pending.intent;
      report.handler = `reject:${pending.intent}`;
      report.diag(`user rejected pending confirmation for intent=${pending.intent}`);
      printDebugReport();
      const reply = "Cancelled. No action was taken. Is there anything else I can help with?";
      session.messages.push({ role: "assistant", content: reply });
      console.log("ACTUAL CUSTOMER RESPONSE");
      return Response.json({ success: true, reply, quickReplies: QUICK_REPLIES_MAP.default, primaryIntent: pending.intent, intents: [pending.intent], executionResult: { action: "cancelled", message: "Action cancelled by user.", needsSelection: false } });
    }

    // ─── Stage 1: Detect intent ──────────────────────────────────────────────
    const { primary: primaryIntent, all: intents, params } = detectIntent(message);
    report.intent = primaryIntent;
    report.handler = primaryIntent;
    report.diag(`detected intents: ${intents.join(", ")}`);

    report.supportRoute = "support execution layer (web chat)";

    // ─── Stage 2: Build support context ───────────────────────────────────────
    const supportCtx = await buildSupportContext({
      userId: user?.id ?? null,
      phone: user?.phone ?? null,
    });

    report.customerLookup = supportCtx ? "SUCCESS" : "FAILED";
    if (supportCtx) {
      report.contextBuilder = "SUCCESS";
      report.customerId = supportCtx.customer.userId ?? supportCtx.customer.phone ?? null;
      report.ordersFound = supportCtx.orderCount;
      report.latestOrder = supportCtx.orders[0]?.orderNumber ?? null;
    } else {
      report.contextBuilder = "FAILED";
      report.diag("buildSupportContext returned null — see context-builder.ts for exact reason (profile query / orders query failed)");
    }

    // ─── Stage 3: Handle no context ───────────────────────────────────────────
    if (!supportCtx || (supportCtx.orderCount === 0 && !["product_question", "cod_question", "support_escalation"].includes(primaryIntent))) {
      session.messages.push({ role: "user", content: message });
      report.failureStage = "no_context_or_orders";
      report.rootCause = supportCtx
        ? `supportCtx.orderCount=${supportCtx.orderCount}, intent=${primaryIntent} not in exempt list`
        : "supportCtx is null";
      printDebugReport();
      const reply = "I couldn't retrieve your account data right now. Please share your order number.";
      session.messages.push({ role: "assistant", content: reply });
      console.log("ACTUAL CUSTOMER RESPONSE");
      return Response.json({ success: true, reply, quickReplies: QUICK_REPLIES_MAP.default, primaryIntent, intents, executionResult: null });
    }

    // ─── Stage 4: Execute handler ─────────────────────────────────────────────
    const handler = intentHandlers[primaryIntent];
    let executionResult: ExecutionResult;

    try {
      executionResult = await handler(supportCtx, params);
    } catch {
      executionResult = { intent: primaryIntent, action: "error", data: {}, message: "Service unavailable. Please try again later.", error: "Handler threw" };
      report.execution = "FAILED";
      report.failureStage = "handler_threw";
      report.rootCause = `handler(${primaryIntent}) threw an exception`;
    }

    report.diag(`executionResult: action=${executionResult.action}, message=${executionResult.message.slice(0, 100)}`);

    // ─── Stage 5: Store pending confirmation if destructive action ────────────
    if (
      executionResult.action === "awaiting_confirmation" &&
      executionResult.confirmationDetails
    ) {
      session.pendingConfirmation = {
        intent: primaryIntent,
        orderNumber: executionResult.confirmationDetails.orderNumber,
        sessionId,
        data: params,
        expiresAt: now + CONFIRMATION_TTL,
      };
      report.diag(`pending confirmation stored — order=${executionResult.confirmationDetails.orderNumber}, session=${sessionId.slice(0, 8)}`);
    }

    // ─── Stage 6: AI formats result ───────────────────────────────────────────
    session.messages.push({ role: "user", content: message });

    let reply: string;
    try {
      reply = await generateSupportFormattedResponse(
        session.messages.slice(-10),
        supportCtx,
        executionResult,
        primaryIntent,
      );
    } catch {
      reply = executionResult.message;
      report.diag("AI formatting failed — used raw executionResult.message as reply");
    }

    session.messages.push({ role: "assistant", content: reply });

    // ─── Quick replies ────────────────────────────────────────────────────────
    let quickReplies = QUICK_REPLIES_MAP.default;
    for (const intent of intents) {
      if (QUICK_REPLIES_MAP[intent]) {
        quickReplies = QUICK_REPLIES_MAP[intent];
        break;
      }
    }

    if (executionResult.action === "needs_selection" && executionResult.eligibleOrders) {
      quickReplies = executionResult.eligibleOrders.slice(0, 4).map(
        (o) => `${o.orderNumber} — ${o.items[0]?.title ?? "Order"}`,
      );
    }

    if (executionResult.action === "awaiting_confirmation") {
      quickReplies = ["YES", "No"];
    }

    console.log(`[support-chat] ok session=${sessionId.slice(0, 8)} user=${supportCtx.customer.isLoggedIn ? supportCtx.customer.email : "guest"} intent=${primaryIntent} action=${executionResult.action} dur=${Date.now() - start}ms`);

    printDebugReport();
    console.log("ACTUAL CUSTOMER RESPONSE");
    return Response.json({
      success: true,
      reply,
      quickReplies,
      primaryIntent,
      intents,
      executionResult: {
        action: executionResult.action,
        message: executionResult.message,
        needsConfirmation: executionResult.action === "awaiting_confirmation",
        needsSelection: executionResult.action === "needs_selection",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[support-chat] error:", msg);
    const report = getDebugReport();
    report.failureStage = "unhandled_exception";
    report.rootCause = msg;
    report.execution = "FAILED";
    printDebugReport();
    console.log("ACTUAL CUSTOMER RESPONSE");

    return Response.json(
      {
        success: false,
        error: "Concierge is temporarily unavailable. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
  });
}
