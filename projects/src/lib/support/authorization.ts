import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { securityLog } from "@/lib/security";
import type { SupportContext } from "./types";
import { DESTRUCTIVE_INTENTS } from "./types";

export type AuthResult = {
  authorized: boolean;
  reason?: string;
  code: string;
};

const DESTRUCTIVE_SET = new Set<string>(DESTRUCTIVE_INTENTS);

export function isDestructiveIntent(intent: string): boolean {
  return DESTRUCTIVE_SET.has(intent);
}

export async function verifyOrderOwnership(params: {
  orderNumber: string;
  phone?: string | null;
  userId?: string | null;
}): Promise<AuthResult> {
  if (!params.phone && !params.userId) {
    return { authorized: false, reason: "No customer identifier provided", code: "no_identifier" };
  }

  try {
    const supabase = createAdminClient();
    const query = supabase
      .from("orders")
      .select("id, user_id, customer_phone, order_number")
      .eq("order_number", params.orderNumber);

    const { data: order } = await query.maybeSingle();

    if (!order) {
      return { authorized: false, reason: "Order not found", code: "order_not_found" };
    }

    if (params.phone) {
      const digits = params.phone.replace(/\D/g, "");
      const orderPhone = String(order.customer_phone ?? "").replace(/\D/g, "");
      if (orderPhone && orderPhone !== digits) {
        securityLog("auth.phone_mismatch", { orderNumber: params.orderNumber });
        return { authorized: false, reason: "Order does not belong to this phone number", code: "phone_mismatch" };
      }
    }

    if (params.userId && order.user_id) {
      if (order.user_id !== params.userId) {
        securityLog("auth.user_mismatch", { orderNumber: params.orderNumber });
        return { authorized: false, reason: "Order does not belong to this user", code: "user_mismatch" };
      }
    }

    return { authorized: true, code: "authorized" };
  } catch {
    return { authorized: false, reason: "Authorization service unavailable", code: "service_unavailable" };
  }
}

export async function verifySessionOwnership(params: {
  sessionId: string;
  phone?: string | null;
  userId?: string | null;
}): Promise<AuthResult> {
  if (!params.sessionId) {
    return { authorized: false, reason: "No session provided", code: "no_session" };
  }

  if (!params.phone && !params.userId) {
    return { authorized: false, reason: "No customer identifier provided", code: "no_identifier" };
  }

  try {
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from("support_sessions")
      .select("id, phone, user_id, is_active")
      .eq("id", params.sessionId)
      .maybeSingle();

    if (!session) {
      return { authorized: false, reason: "Session not found", code: "session_not_found" };
    }

    if (session.is_active === false) {
      return { authorized: false, reason: "Session is inactive", code: "session_inactive" };
    }

    if (params.phone) {
      const sessionPhone = String(session.phone ?? "").replace(/\D/g, "");
      const reqPhone = params.phone.replace(/\D/g, "");
      if (sessionPhone && sessionPhone !== reqPhone) {
        return { authorized: false, reason: "Session phone mismatch", code: "session_phone_mismatch" };
      }
    }

    if (params.userId && session.user_id && session.user_id !== params.userId) {
      return { authorized: false, reason: "Session user mismatch", code: "session_user_mismatch" };
    }

    return { authorized: true, code: "authorized" };
  } catch {
    return { authorized: false, reason: "Session verification unavailable", code: "session_service_unavailable" };
  }
}

export async function authorizeDestructiveAction(params: {
  intent: string;
  orderNumber: string;
  context: SupportContext;
  sessionId?: string;
}): Promise<AuthResult> {
  if (!isDestructiveIntent(params.intent)) {
    return { authorized: true, code: "non_destructive" };
  }

  const phone = params.context.customer.phone;
  const userId = params.context.customer.userId;

  const orderAuth = await verifyOrderOwnership({
    orderNumber: params.orderNumber,
    phone,
    userId,
  });

  if (!orderAuth.authorized) {
    securityLog("auth.destructive_blocked", {
      intent: params.intent,
      orderNumber: params.orderNumber,
      reason: orderAuth.reason,
      code: orderAuth.code,
    });
    return orderAuth;
  }

  if (params.sessionId) {
    const sessionAuth = await verifySessionOwnership({
      sessionId: params.sessionId,
      phone,
      userId,
    });

    if (!sessionAuth.authorized) {
      securityLog("auth.session_blocked", {
        intent: params.intent,
        sessionId: params.sessionId,
        reason: sessionAuth.reason,
        code: sessionAuth.code,
      });
      return sessionAuth;
    }
  }

  const order = params.context.orders.find((o) => o.orderNumber === params.orderNumber);
  if (!order) {
    return { authorized: false, reason: "Order not found in context", code: "order_not_in_context" };
  }

  return { authorized: true, code: "authorized" };
}
