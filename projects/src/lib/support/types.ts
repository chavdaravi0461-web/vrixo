export type SupportIntent =
  | "order_status"
  | "cancel_order"
  | "return_order"
  | "replace_order"
  | "payment_issue"
  | "tracking"
  | "product_question"
  | "cod_question"
  | "refund"
  | "support_escalation";

export const DESTRUCTIVE_INTENTS: readonly SupportIntent[] = [
  "cancel_order",
  "refund",
  "return_order",
  "replace_order",
];

export type ExecutionAction =
  | "awaiting_confirmation"
  | "executed"
  | "needs_selection"
  | "not_found"
  | "not_eligible"
  | "error"
  | "blocked"
  | "rate_limited"
  | "fraud_blocked";

export type SupportOrder = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ title: string; quantity: number; price: number }>;
  shippingAddress: Record<string, unknown> | null;
  isCancellable: boolean;
  isReturnable: boolean;
  trackingNumber: string | null;
  courier: string | null;
  estimatedDelivery: string | null;
};

export type SupportPayment = {
  orderNumber: string;
  status: string;
  method: string;
  amount: number;
  paidAt: string | null;
};

export type SupportContext = {
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    userId: string | null;
    isLoggedIn: boolean;
  };
  orders: SupportOrder[];
  activeOrders: SupportOrder[];
  cancelledOrders: SupportOrder[];
  refundedOrders: SupportOrder[];
  hasActiveOrders: boolean;
  orderCount: number;
  cart: { itemCount: number; total: number; items: string[] };
};

export type ExecutionResult = {
  intent: SupportIntent;
  action: ExecutionAction;
  data: Record<string, unknown>;
  message: string;
  eligibleOrders?: SupportOrder[];
  error?: string;
  confirmationRequired?: boolean;
  confirmationDetails?: {
    orderNumber: string;
    orderStatus: string;
    action: string;
    consequence: string;
  };
};

export type PendingConfirmation = {
  intent: SupportIntent;
  orderNumber: string;
  sessionId: string;
  data: Record<string, unknown>;
  expiresAt: number;
};

export type AuditEntry = {
  timestamp: string;
  customerId: string | null;
  customerPhone: string | null;
  sessionId: string;
  intent: SupportIntent;
  action: ExecutionAction;
  orderNumber: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
};

export type IntentHandler = (
  ctx: SupportContext,
  params?: Record<string, unknown>,
) => Promise<ExecutionResult>;
