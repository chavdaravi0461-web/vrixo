import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/utils";
import { isValidOrderNumber, normalizeOrderNumber } from "@/lib/orders/order-numbers";

export type OrderRecord = {
  id: string;
  user_id: string;
  order_number: string;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string | null;
  razorpay_payment_id: string | null;
  created_at: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  shipping_address: unknown;
  items: unknown;
  whatsapp_status: string | null;
  whatsapp_error: string | null;
};

export function canQueryOrders() {
  return isSupabaseConfigured() && hasServerSupabaseAdminEnv();
}

export async function findOrderForUser(orderNumberRaw: string, userId: string) {
  const orderNumber = normalizeOrderNumber(orderNumberRaw);

  if (!isValidOrderNumber(orderNumber)) {
    return null;
  }

  if (!canQueryOrders()) {
    return null;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, user_id, order_number, total, payment_method, payment_status, order_status, razorpay_payment_id, created_at, customer_phone, customer_name, shipping_address, items, whatsapp_status, whatsapp_error"
    )
    .eq("order_number", orderNumber)
    .eq("user_id", userId)
    .maybeSingle();

  return (data as OrderRecord | null) ?? null;
}

export async function findOrderByOrderNumber(orderNumberRaw: string) {
  const orderNumber = normalizeOrderNumber(orderNumberRaw);
  if (!isValidOrderNumber(orderNumber)) return null;
  if (!canQueryOrders()) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id, user_id, order_number, total, payment_method, payment_status, order_status, razorpay_payment_id, created_at, customer_phone, customer_name, shipping_address, items, whatsapp_status, whatsapp_error")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as OrderRecord | null) ?? null;
}

export async function findOrderForUserWithRetry(
  orderNumberRaw: string,
  userId: string,
  attempts = 4,
  delayMs = 350
) {
  for (let index = 0; index < attempts; index += 1) {
    const order = await findOrderForUser(orderNumberRaw, userId);
    if (order) {
      return order;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * (index + 1)));
    }
  }

  return null;
}
