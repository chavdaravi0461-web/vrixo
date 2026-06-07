export {
  authorizeDestructiveAction,
  verifyOrderOwnership,
  verifySessionOwnership,
  isDestructiveIntent,
} from "./authorization";
export type { AuthResult } from "./authorization";

export {
  checkSupportRateLimit,
  checkCancellationRateLimit,
  checkRefundRateLimit,
  checkReturnRateLimit,
  checkSupportSpamRateLimit,
  checkConfirmationRateLimit,
  checkOrderLookupRateLimit,
  resetRateLimitMemoryFallback,
} from "./rate-limits";
export type { RateLimitResult, RateLimitConfig } from "./rate-limits";

export {
  generateActionId,
  checkIdempotency,
  markIdempotencyComplete,
  markIdempotencyFailed,
  trackInFlight,
  isOrderConfirmationProcessed,
  markOrderConfirmationProcessed,
  isRecentlyProcessed,
  releaseIdempotencyLock,
} from "./idempotency";
export type { IdempotencyRecord, IdempotencyResult } from "./idempotency";

export {
  assessFraudRisk,
  trackAction,
  getActionCount,
  checkOrderProbeFraud,
} from "./fraud-detection";
export type { FraudAssessment } from "./fraud-detection";

export {
  createPendingConfirmation,
  getPendingConfirmation,
  confirmPendingConfirmation,
  markConfirmationExecuted,
  deletePendingConfirmation,
  getPendingConfirmationsForPhone,
  expireStaleConfirmations,
  clearAllConfirmationsForPhone,
  saveSessionState,
  getSessionState,
  clearSessionState,
} from "./session-manager";
export type { PendingConfirmation } from "./session-manager";

export {
  recordIntent,
  recordDestructiveAction,
  recordConfirmationConversion,
  recordSupportFailure,
  getSupportMetrics,
  trackExecutionLatency,
  getMetricsFromRedis,
  recordSupportFailure as recordError,
} from "./observability";

export {
  getEmergencyStatus,
  checkDestructiveAllowed,
  isDestructiveIntent as isDestructiveIntentEmergency,
  resetCachedStatus,
} from "./emergency-fallback";
export type { EmergencyStatus } from "./emergency-fallback";

export type {
  SupportIntent,
  SupportOrder,
  SupportContext,
  ExecutionResult,
  PendingConfirmation as PendingConfirmationType,
  AuditEntry,
  IntentHandler,
  ExecutionAction,
  SupportPayment,
} from "./types";
export { DESTRUCTIVE_INTENTS } from "./types";

export {
  intentHandlers,
  handleOrderStatus,
  handleCancelOrder,
  handleRefund,
  handleReturn,
  handleReplace,
  handleTracking,
  handlePaymentIssue,
} from "./executor";
