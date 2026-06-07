import "server-only";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { sanitizeCustomerPhone } from "@/lib/whatsapp/phone";
import { withRedis } from "@/lib/redis";
import { getDebugReport } from "@/lib/whatsapp/debug-report";

function trace(event: string, details?: Record<string, unknown>) {
  console.log(`[CUSTOMER] ${event}`, details ?? {});
}

async function withRetry<T>(label: string, task: () => Promise<T>, maxRetries = 3): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await task();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        trace("RETRY", { label, attempt, error: msg });
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      } else {
        trace("RETRY_EXHAUSTED", { label, error: msg });
        return null;
      }
    }
  }
  return null;
}

function isConnectionOrTimeout(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("network") || msg.includes("socket") || msg.includes("fetch failed");
}

export type OrderItemDisplay = {
  title: string;
  quantity: number;
  price: number;
  imageUrl: string;
  sku: string;
};

export type CustomerOrderDetailed = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  originalAmount: number;
  discountAmount: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: Record<string, unknown> | null;
  items: OrderItemDisplay[];
  isCancellable: boolean;
};

export type CartItemSummary = {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
};

export type CustomerContext = {
  name: string | null;
  phone: string | null;
  userId: string | null;
  orders: CustomerOrderDetailed[];
  activeOrders: CustomerOrderDetailed[];
  cancelledOrders: CustomerOrderDetailed[];
  orderCount: number;
  hasActiveOrders: boolean;
  currentCart: CartItemSummary[];
  cartItemCount: number;
  cartTotal: number;
  pendingPayments: CustomerOrderDetailed[];
  hasPendingPayments: boolean;
  customerSegment: string | null;
  ltv: number | null;
  churnRisk: number | null;
};

const ORDER_QUERY_FIELDS = `
  order_number, order_status, payment_status, payment_method,
  total, original_amount, discount_amount, created_at,
  customer_name, customer_phone, shipping_address, items
`;

function isCancellable(status: string): boolean {
  const lower = status.toLowerCase();
  return lower === "pending" || lower === "confirmed";
}

function normalizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending" || s === "confirmed" || s === "processing" || s === "packed" || s === "shipped" || s === "delivered" || s === "cancelled") return s;
  return "pending";
}

function buildOrderDetailed(raw: Record<string, unknown>): CustomerOrderDetailed {
  const status = normalizeStatus(String(raw.order_status ?? ""));
  const items: OrderItemDisplay[] = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map((i) => ({
        title: String(i.title ?? i.productTitle ?? "Product"),
        quantity: Number(i.quantity ?? 1),
        price: Number(i.price ?? 0),
        imageUrl: String(
          (Array.isArray(i.images) && i.images[0]) ||
          (Array.isArray(i.imageUrl) && i.imageUrl[0]) ||
          (typeof i.imageUrl === "string" ? i.imageUrl : "") ||
          (typeof i.image === "string" ? i.image : "") ||
          ""
        ),
        sku: String(i.sku ?? ""),
      }))
    : [];

  return {
    orderNumber: String(raw.order_number ?? ""),
    orderStatus: status,
    paymentStatus: String(raw.payment_status ?? "").toLowerCase(),
    paymentMethod: String(raw.payment_method ?? "").toLowerCase(),
    total: Number(raw.total ?? 0),
    originalAmount: Number(raw.original_amount ?? raw.total ?? 0),
    discountAmount: Number(raw.discount_amount ?? 0),
    createdAt: String(raw.created_at ?? ""),
    customerName: String(raw.customer_name ?? ""),
    customerPhone: String(raw.customer_phone ?? ""),
    shippingAddress: (raw.shipping_address as Record<string, unknown>) ?? null,
    items,
    isCancellable: isCancellable(String(raw.order_status ?? "")),
  };
}

async function getUserIdByPhone(phone: string): Promise<string | null> {
  const report = getDebugReport();
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) return null;
  return withRedis(async (r) => {
    const cached = await r.get(`customer:userid:${digits}`);
    if (cached) {
      const val = cached === "__none__" ? null : cached;
      if (val) report.diag(`getUserIdByPhone: cache hit — userId=${val.slice(0, 8)}...`);
      else report.diag("getUserIdByPhone: cache hit — __none__ (no user mapping exists)");
      return val;
    }
    const supabase = tryCreateAdminClient();
    if (!supabase) {
      report.diag("getUserIdByPhone: supabase client null");
      return null;
    }
    try {
      const { data } = await supabase
        .from("customer_mappings")
        .select("user_id")
        .eq("phone", digits)
        .maybeSingle();
      if (data?.user_id) {
        await r.setex(`customer:userid:${digits}`, 3600, data.user_id as string);
        report.diag(`getUserIdByPhone: found via customer_mappings — userId=${(data.user_id as string).slice(0, 8)}...`);
        return data.user_id as string;
      }
      report.diag(`getUserIdByPhone: customer_mappings query returned 0 rows for phone=${digits}`);
    } catch (err) {
      report.diag(`getUserIdByPhone: customer_mappings query threw — ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const { data: orderUser } = await supabase
        .from("orders")
        .select("user_id")
        .eq("customer_phone", digits)
        .not("user_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (orderUser?.user_id) {
        await r.setex(`customer:userid:${digits}`, 3600, orderUser.user_id as string);
        report.diag(`getUserIdByPhone: found via orders fallback — userId=${(orderUser.user_id as string).slice(0, 8)}...`);
        return orderUser.user_id as string;
      }
      report.diag(`getUserIdByPhone: orders fallback query returned 0 rows for phone=${digits}`);
    } catch (err) {
      report.diag(`getUserIdByPhone: orders fallback query threw — ${err instanceof Error ? err.message : String(err)}`);
    }
    report.diag("getUserIdByPhone: no user mapping found — user will be null");
    await r.setex(`customer:userid:${digits}`, 300, "__none__");
    return null;
  }, null);
}

async function loadCustomerMemory(userId: string | null) {
  if (!userId) return null;
  try {
    const { getCustomerMemory } = await import("@/services/ai/customer-memory");
    return await getCustomerMemory(userId);
  } catch {
    return null;
  }
}

async function loadCurrentCart(userId: string | null) {
  if (!userId) return { items: [], itemCount: 0, total: 0 };
  try {
    const { valkeyCart } = await import("@/lib/valkey/cart");
    const items = await valkeyCart.get(userId);
    if (!items || items.length === 0) return { items: [], itemCount: 0, total: 0 };
    return {
      items: items.map((i) => ({
        productId: i.productId,
        title: i.title,
        image: i.image,
        price: i.price,
        quantity: i.quantity,
      })),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    };
  } catch {
    return { items: [], itemCount: 0, total: 0 };
  }
}

export async function getCustomerFromWhatsApp(phone: string): Promise<CustomerContext | null> {
  const report = getDebugReport();
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) {
    trace("INVALID_PHONE", { phone: `***${String(phone).slice(-4)}` });
    report.diag(`getCustomerFromWhatsApp: INVALID_PHONE — raw="${String(phone).slice(-4)}" sanitizeCustomerPhone returned empty`);
    report.failureStage = "invalid_phone";
    report.rootCause = `sanitizeCustomerPhone("${String(phone).slice(-4)}") returned empty — does not match Indian phone regex /^[6-9]\\d{9}$/`;
    return null;
  }
  report.orderPhoneQuery = `SELECT ${ORDER_QUERY_FIELDS} FROM orders WHERE customer_phone = '${digits}' ORDER BY created_at DESC LIMIT 25`;

  const cacheKey = `customer:context:${digits}`;
  const cached = await withRedis(async (r) => {
    const val = await r.get(cacheKey);
    return val ? (JSON.parse(val) as CustomerContext) : null;
  }, null);
  if (cached) {
    trace("CACHE_HIT", { phone: `***${digits.slice(-4)}`, orderCount: cached.orderCount });
    report.diag(`getCustomerFromWhatsApp: CACHE_HIT — ${cached.orderCount} orders`);
    return cached;
  }

  const lockKey = `customer:lock:${digits}`;
  const lockAcquired = await withRedis(async (r) => {
    const result = await r.set(lockKey, "1", "EX", 5, "NX");
    return result !== null;
  }, false);

  if (!lockAcquired) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const val = await withRedis(async (r) => r.get(cacheKey), null);
      if (val) {
        const parsed = JSON.parse(val) as CustomerContext;
        trace("CACHE_STAMPEDE_WAIT", { phone: `***${digits.slice(-4)}` });
        return parsed;
      }
    }
    trace("CACHE_STAMPEDE_TIMEOUT", { phone: `***${digits.slice(-4)}` });
  }

  try {
    trace("CUSTOMER_LOOKUP", { phone: `***${digits.slice(-4)}` });

    const supabase = tryCreateAdminClient();
    let orders: Record<string, unknown>[] | null = null;

    if (!supabase) {
      trace("DB_UNAVAILABLE", { phone: `***${digits.slice(-4)}` });
      report.diag("getCustomerFromWhatsApp: DB_UNAVAILABLE — tryCreateAdminClient() returned null");
      report.failureStage = "supabase_null";
      report.rootCause = "tryCreateAdminClient() returned null — check Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SERVICE_ROLE_KEY)";
      return null;
    }

    const ordersResult = await withRetry("supabase.orders", async () =>
      supabase
        .from("orders")
        .select(ORDER_QUERY_FIELDS)
        .eq("customer_phone", digits)
        .order("created_at", { ascending: false })
        .limit(25)
    );
    orders = ordersResult?.data ?? null;

    if (orders === null) {
      trace("DB_DEGRADED", { phone: `***${digits.slice(-4)}` });
      report.diag("getCustomerFromWhatsApp: DB_DEGRADED — ordersResult?.data is null after 3 retries");
      report.failureStage = "db_degraded";
      report.rootCause = `orders query returned null after 3 retries — Supabase may be unreachable or query failed`;
      return null;
    }

    if (orders.length === 0) {
      trace("PHONE_LOOKUP_EMPTY", { phone: `***${digits.slice(-4)}`, digits });
      console.log("[CUSTOMER] PHONE_LOOKUP_EMPTY — 0 orders for phone", { digits, rawInput: phone });
      // Fallback: try to find user_id by phone, then query orders by user_id
      const fallbackUserId = await getUserIdByPhone(digits);
      if (fallbackUserId) {
        trace("USERID_FALLBACK", { userId: fallbackUserId.slice(0, 8), phone: `***${digits.slice(-4)}` });
        console.log("[CUSTOMER] USERID_FALLBACK — looking up orders by user_id", { userId: fallbackUserId.slice(0, 8) });
        const userOrdersResult = await withRetry("supabase.orders.userid", async () =>
          supabase
            .from("orders")
            .select(ORDER_QUERY_FIELDS)
            .eq("user_id", fallbackUserId)
            .order("created_at", { ascending: false })
            .limit(25)
        );
        orders = userOrdersResult?.data ?? null;
        if (orders && orders.length > 0) {
          trace("USERID_FALLBACK_SUCCESS", { count: orders.length });
          console.log("[CUSTOMER] USERID_FALLBACK_SUCCESS — found", orders.length, "orders via user_id");
        } else {
          console.log("[CUSTOMER] USERID_FALLBACK_FAILED — no orders via user_id either");
        }
      } else {
        console.log("[CUSTOMER] USERID_FALLBACK — no user_id found for phone", { digits });
      }
    }

    if (orders === null || orders.length === 0) {
      const empty: CustomerContext = {
        name: null,
        phone: digits,
        userId: null,
        orders: [],
        activeOrders: [],
        cancelledOrders: [],
        orderCount: 0,
        hasActiveOrders: false,
        currentCart: [],
        cartItemCount: 0,
        cartTotal: 0,
        pendingPayments: [],
        hasPendingPayments: false,
        customerSegment: null,
        ltv: null,
        churnRisk: null,
      };
      await withRedis(async (r) => { await r.setex(cacheKey, 60, JSON.stringify(empty)); return true; }, false);
      trace("NO_ORDERS", { phone: `***${digits.slice(-4)}` });
      report.ordersFound = 0;
      report.latestOrder = null;
      report.diag(`getCustomerFromWhatsApp: NO_ORDERS — query returned 0 rows for phone=${digits}`);
      return empty;
    }

    const detailed = (orders as Record<string, unknown>[]).map(buildOrderDetailed);
    const name = detailed[0]?.customerName ?? null;

    report.ordersFound = detailed.length;
    report.latestOrder = detailed[0]?.orderNumber ?? null;
    report.customerId = digits;

    const userId = await getUserIdByPhone(digits);
    report.userId = userId;
    report.userLookup = userId ? "SUCCESS" : "FAILED";
    const memory = userId ? await loadCustomerMemory(userId) : null;
    const cart = await loadCurrentCart(userId);
    const pendingPayments = detailed.filter(
      (o) => (o.paymentStatus === "pending" || o.paymentStatus === "cod_pending") && o.orderStatus !== "cancelled"
    );

    const ctx: CustomerContext = {
      name,
      phone: digits,
      userId,
      orders: detailed,
      activeOrders: detailed.filter((o) => o.orderStatus !== "cancelled"),
      cancelledOrders: detailed.filter((o) => o.orderStatus === "cancelled"),
      orderCount: detailed.length,
      hasActiveOrders: detailed.some((o) => o.orderStatus !== "cancelled"),
      currentCart: cart.items,
      cartItemCount: cart.itemCount,
      cartTotal: cart.total,
      pendingPayments,
      hasPendingPayments: pendingPayments.length > 0,
      customerSegment: memory?.lifetime?.customerSegment ?? null,
      ltv: memory?.lifetime?.ltv ?? null,
      churnRisk: memory?.lifetime?.predictedChurnRisk ?? null,
    };

    await withRedis(async (r) => { await r.setex(cacheKey, 120, JSON.stringify(ctx)); return true; }, false);
    trace("CONTEXT_LOADED", {
      phone: `***${digits.slice(-4)}`,
      orderCount: ctx.orderCount,
      activeCount: ctx.activeOrders.length,
      cartCount: ctx.cartItemCount,
      userId: userId ? `${userId.slice(0, 8)}...` : null,
    });
    return ctx;
  } finally {
    await withRedis(async (r) => { await r.del(lockKey); return true; }, false);
  }
}

export async function getCustomerOrders(
  phone: string,
  status?: "active" | "cancelled" | "all"
): Promise<CustomerOrderDetailed[]> {
  const ctx = await getCustomerFromWhatsApp(phone);
  if (!ctx) return [];
  if (status === "active") return ctx.activeOrders;
  if (status === "cancelled") return ctx.cancelledOrders;
  return ctx.orders;
}

export async function getOrderByNumber(
  orderNumber: string,
  phone: string
): Promise<CustomerOrderDetailed | null> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits || !orderNumber) return null;

  const supabase = tryCreateAdminClient();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_QUERY_FIELDS)
      .eq("order_number", orderNumber)
      .eq("customer_phone", digits)
      .maybeSingle();

    if (!data) return null;
    return buildOrderDetailed(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function prefetchCustomerContext(phone: string): Promise<CustomerContext | null> {
  const ctx = await getCustomerFromWhatsApp(phone);
  if (ctx && ctx.orderCount > 0) {
    trace("PREFETCH_COMPLETE", { phone: `***${String(phone).slice(-4)}`, orderCount: ctx.orderCount });
  }
  return ctx;
}

export async function cancelCustomerOrder(
  orderNumber: string,
  phone: string,
  reason?: string
): Promise<{ success: boolean; error?: string; order?: CustomerOrderDetailed }> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) return { success: false, error: "Invalid phone number" };

  const supabase = tryCreateAdminClient();
  if (!supabase) return { success: false, error: "Order service unavailable. Please try again later." };

  let order: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, order_status, customer_phone, notes, user_id")
      .eq("order_number", orderNumber)
      .eq("customer_phone", digits)
      .maybeSingle();
    order = data as Record<string, unknown> | null;
  } catch {
    return { success: false, error: "Unable to verify order. Please try again." };
  }

  if (!order) return { success: false, error: "Order not found" };

  if (!isCancellable(String(order.order_status ?? ""))) {
    return { success: false, error: `Order is ${order.order_status} and cannot be cancelled. Cancellation is only available for pending or confirmed orders.` };
  }

  const existingNotes = (order.notes as Record<string, unknown>) ?? {};
  const cancelNotes = {
    ...existingNotes,
    cancelled_at: new Date().toISOString(),
    cancelled_via: "whatsapp",
    cancellation_reason: reason || "Customer requested via WhatsApp",
  };

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        order_status: "cancelled",
        payment_status: "refunded",
        notes: cancelNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      trace("CANCEL_FAILED", { orderNumber, error: error.message });
      return { success: false, error: "Failed to cancel order. Please try again." };
    }
  } catch {
    trace("CANCEL_FAILED", { orderNumber, error: "update query threw" });
    return { success: false, error: "Order service unavailable. Please try again later." };
  }

  const digitsOnly = sanitizeCustomerPhone(phone);
  const cacheKey = `customer:context:${digitsOnly}`;
  await withRedis(async (r) => { await r.del(cacheKey); return true; }, false);

  const userId = order.user_id as string | null;
  if (userId) {
    const memoryCacheKey = `customer:memory-invalid:${userId}`;
    await withRedis(async (r) => { await r.set(memoryCacheKey, "1", "EX", 5); return true; }, false);
  }

  const updated = await getOrderByNumber(orderNumber, digits);
  if (!updated || updated.orderStatus !== "cancelled") {
    trace("CANCEL_VERIFY_FAILED", { orderNumber, phone: `***${digitsOnly.slice(-4)}` });
    return { success: false, error: "I could not verify the cancellation yet. I am checking your account details." };
  }

  await syncMyOrdersPage(digitsOnly);
  const verified = await getOrderByNumber(orderNumber, digits);
  if (!verified || verified.orderStatus !== "cancelled") {
    trace("CANCEL_SYNC_VERIFY_FAILED", { orderNumber, phone: `***${digitsOnly.slice(-4)}` });
    return { success: false, error: "I could not verify the cancellation sync yet. I am checking your account details." };
  }

  trace("CANCEL_SUCCESS", { orderNumber, phone: `***${digitsOnly.slice(-4)}` });
  return { success: true, order: verified };
}

export async function syncOrderStatus(phone: string): Promise<{
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  changed: boolean;
}[]> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) return [];

  const cacheKey = `customer:context:${digits}`;
  const cached = await withRedis(async (r) => {
    const val = await r.get(cacheKey);
    return val ? (JSON.parse(val) as CustomerContext) : null;
  }, null);

  if (!cached) return [];

  const supabase = tryCreateAdminClient();
  if (!supabase) return [];

  let fresh: unknown = null;
  try {
    const { data } = await supabase
      .from("orders")
      .select("order_number, order_status")
      .eq("customer_phone", digits)
      .limit(25);
    fresh = data;
  } catch {
    return [];
  }

  if (!fresh) return [];

  const changes: { orderNumber: string; oldStatus: string; newStatus: string; changed: boolean }[] = [];
  for (const row of fresh as Array<{ order_number: string; order_status: string }>) {
    const cachedOrder = cached.orders.find((o) => o.orderNumber === row.order_number);
    const oldStatus = cachedOrder?.orderStatus ?? "unknown";
    const newStatus = normalizeStatus(String(row.order_status ?? ""));
    if (oldStatus !== newStatus) {
      changes.push({ orderNumber: row.order_number, oldStatus, newStatus, changed: true });
    }
  }

  if (changes.length > 0) {
    await withRedis(async (r) => { await r.del(cacheKey); return true; }, false);
  }

  return changes;
}

export async function syncMyOrdersPage(phone: string): Promise<CustomerContext | null> {
  const digits = sanitizeCustomerPhone(phone);
  if (!digits) return null;

  const cacheKey = `customer:context:${digits}`;
  await withRedis(async (r) => { await r.del(cacheKey); return true; }, false);

  return getCustomerFromWhatsApp(phone);
}
