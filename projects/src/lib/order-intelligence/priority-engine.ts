export type PriorityLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type PriorityCategory =
  | "critical_order"
  | "payment_issue"
  | "delivery_issue"
  | "account_issue"
  | "product_question"
  | "sales";

export type PriorityResult = {
  level: PriorityLevel;
  category: PriorityCategory;
  label: string;
  isUrgent: boolean;
  shouldEscalate: boolean;
};

const PRIORITY_MAP: Record<PriorityCategory, { level: PriorityLevel; label: string }> = {
  critical_order: { level: 1, label: "Critical Order Issue" },
  payment_issue: { level: 2, label: "Payment Issue" },
  delivery_issue: { level: 3, label: "Delivery Issue" },
  account_issue: { level: 4, label: "Account Issue" },
  product_question: { level: 5, label: "Product Question" },
  sales: { level: 6, label: "Sales & Browse" },
};

type ClassifyInput = {
  intents: string[];
  emotion: string;
  hasPendingPayments: boolean;
  hasActiveOrders: boolean;
  hasUrgentOrder: boolean;
  consecutiveRefundRequests: number;
  escalatedBefore: boolean;
  mentionedOrderNumber: string | null;
  orderStatus: string | null;
};

export function classifyPriority(input: ClassifyInput): PriorityResult {
  const { intents, emotion, hasPendingPayments, hasUrgentOrder, consecutiveRefundRequests, escalatedBefore, mentionedOrderNumber, orderStatus } = input;

  // Priority 1: Critical order issue — payment failure, fraud, blocked, refund chain
  if (intents.includes("cancel") && orderStatus && !["pending", "confirmed"].includes(orderStatus)) {
    return { level: 3, category: "delivery_issue", label: "Cancellation not eligible — delivery inquiry", isUrgent: false, shouldEscalate: false };
  }

  if (intents.includes("payment_issue") || hasPendingPayments) {
    return {
      level: hasPendingPayments ? 2 : 3,
      category: "payment_issue",
      label: hasPendingPayments ? "Pending Payment Follow-up" : "Payment Inquiry",
      isUrgent: hasPendingPayments,
      shouldEscalate: consecutiveRefundRequests >= 3,
    };
  }

  if (intents.includes("cancel") && orderStatus && ["pending", "confirmed"].includes(orderStatus)) {
    return { level: 2, category: "critical_order", label: "Cancellation Request", isUrgent: true, shouldEscalate: false };
  }

  if (hasUrgentOrder && intents.includes("order_status")) {
    return { level: 3, category: "delivery_issue", label: "Urgent Order Status", isUrgent: true, shouldEscalate: false };
  }

  if (emotion === "frustrated" || emotion === "urgent") {
    return {
      level: intents.includes("cancel") || intents.includes("refund") || intents.includes("payment_issue") ? 2 : 3,
      category: intents.includes("delivery") ? "delivery_issue" : "account_issue",
      label: "Frustrated Customer",
      isUrgent: true,
      shouldEscalate: escalatedBefore,
    };
  }

  if (intents.includes("delivery") || intents.includes("tracking")) {
    return { level: 3, category: "delivery_issue", label: "Delivery/Tracking Inquiry", isUrgent: false, shouldEscalate: false };
  }

  if (intents.includes("refund") || intents.includes("exchange") || intents.includes("return")) {
    return { level: consecutiveRefundRequests >= 2 ? 3 : 4, category: "account_issue", label: "Return/Refund Request", isUrgent: false, shouldEscalate: consecutiveRefundRequests >= 3 };
  }

  if (intents.includes("coupon") || intents.includes("discount")) {
    return { level: 5, category: "sales", label: "Coupon/Discount Inquiry", isUrgent: false, shouldEscalate: false };
  }

  if (intents.includes("recommend") || intents.includes("browse") || intents.includes("shop")) {
    return { level: 6, category: "sales", label: "Product Recommendations", isUrgent: false, shouldEscalate: false };
  }

  if (intents.includes("order_status") || intents.includes("status")) {
    return { level: 4, category: "account_issue", label: "Order Status Inquiry", isUrgent: false, shouldEscalate: false };
  }

  return { level: 6, category: "product_question", label: "General Inquiry", isUrgent: false, shouldEscalate: false };
}

export function getTriageSummary(category: PriorityCategory): string {
  switch (category) {
    case "critical_order": return "⚠️ Critical — resolving immediately";
    case "payment_issue": return "💰 Payment — processing with urgency";
    case "delivery_issue": return "📦 Delivery — checking status";
    case "account_issue": return "👤 Account — handling request";
    case "product_question": return "🛍️ Product — providing details";
    case "sales": return "✨ Sales — assisting with browse";
  }
}
