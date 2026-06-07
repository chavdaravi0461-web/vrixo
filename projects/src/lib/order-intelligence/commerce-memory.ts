import { withRedis } from "@/lib/redis";

export type CommerceSession = {
  phone: string;
  previousQuestions: string[];
  previousOrdersDiscussed: string[];
  unresolvedIssues: string[];
  previousRecommendations: string[];
  abandonedPaymentOrderNumbers: string[];
  lastConversationSummary: string | null;
  lastInteractionAt: string;
  sessionStartAt: string;
  activeCartProductIds: string[];
  consecutiveRefundRequests: number;
  escalatedBefore: boolean;
};

const TTL_SECONDS = 86400;
const MAX_QUESTIONS = 20;
const MAX_ORDERS_DISCUSSED = 15;
const MAX_ISSUES = 10;
const MAX_RECOMMENDATIONS = 10;

function emptySession(phone: string): CommerceSession {
  return {
    phone,
    previousQuestions: [],
    previousOrdersDiscussed: [],
    unresolvedIssues: [],
    previousRecommendations: [],
    abandonedPaymentOrderNumbers: [],
    lastConversationSummary: null,
    lastInteractionAt: new Date().toISOString(),
    sessionStartAt: new Date().toISOString(),
    activeCartProductIds: [],
    consecutiveRefundRequests: 0,
    escalatedBefore: false,
  };
}

function sessionKey(phone: string): string {
  return `commerce:memory:${phone}`;
}

export async function getCommerceSession(phone: string): Promise<CommerceSession> {
  const key = sessionKey(phone);
  const raw = await withRedis(async (r) => r.get(key), null);
  if (raw) {
    try {
      return JSON.parse(raw) as CommerceSession;
    } catch {
      return emptySession(phone);
    }
  }
  return emptySession(phone);
}

export async function saveCommerceSession(session: CommerceSession): Promise<void> {
  const key = sessionKey(session.phone);
  session.lastInteractionAt = new Date().toISOString();
  await withRedis(async (r) => {
    await r.setex(key, TTL_SECONDS, JSON.stringify(session));
    return true;
  }, undefined);
}

export async function recordQuestion(phone: string, question: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.previousQuestions.unshift(question);
  if (session.previousQuestions.length > MAX_QUESTIONS) {
    session.previousQuestions = session.previousQuestions.slice(0, MAX_QUESTIONS);
  }
  await saveCommerceSession(session);
}

export async function recordOrderDiscussed(phone: string, orderNumber: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.previousOrdersDiscussed = session.previousOrdersDiscussed.filter((o) => o !== orderNumber);
  session.previousOrdersDiscussed.unshift(orderNumber);
  if (session.previousOrdersDiscussed.length > MAX_ORDERS_DISCUSSED) {
    session.previousOrdersDiscussed = session.previousOrdersDiscussed.slice(0, MAX_ORDERS_DISCUSSED);
  }
  await saveCommerceSession(session);
}

export async function recordIssue(phone: string, issue: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.unresolvedIssues.unshift(issue);
  if (session.unresolvedIssues.length > MAX_ISSUES) {
    session.unresolvedIssues = session.unresolvedIssues.slice(0, MAX_ISSUES);
  }
  await saveCommerceSession(session);
}

export async function resolveIssue(phone: string, issue: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.unresolvedIssues = session.unresolvedIssues.filter((i) => i !== issue);
  await saveCommerceSession(session);
}

export async function recordRecommendation(phone: string, recommendation: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.previousRecommendations.unshift(recommendation);
  if (session.previousRecommendations.length > MAX_RECOMMENDATIONS) {
    session.previousRecommendations = session.previousRecommendations.slice(0, MAX_RECOMMENDATIONS);
  }
  await saveCommerceSession(session);
}

export async function recordAbandonedPayment(phone: string, orderNumber: string): Promise<void> {
  const session = await getCommerceSession(phone);
  if (!session.abandonedPaymentOrderNumbers.includes(orderNumber)) {
    session.abandonedPaymentOrderNumbers.push(orderNumber);
  }
  await saveCommerceSession(session);
}

export async function clearAbandonedPayment(phone: string, orderNumber: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.abandonedPaymentOrderNumbers = session.abandonedPaymentOrderNumbers.filter((o) => o !== orderNumber);
  await saveCommerceSession(session);
}

export async function updateConversationSummary(phone: string, summary: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.lastConversationSummary = summary;
  await saveCommerceSession(session);
}

export async function incrementRefundRequests(phone: string): Promise<number> {
  const session = await getCommerceSession(phone);
  session.consecutiveRefundRequests++;
  await saveCommerceSession(session);
  return session.consecutiveRefundRequests;
}

export async function markEscalated(phone: string): Promise<void> {
  const session = await getCommerceSession(phone);
  session.escalatedBefore = true;
  await saveCommerceSession(session);
}

export async function clearCommerceSession(phone: string): Promise<void> {
  const key = sessionKey(phone);
  await withRedis(async (r) => { await r.del(key); return true; }, undefined);
}
