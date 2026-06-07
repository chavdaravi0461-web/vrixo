import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";

export type ConsistencyDiff = {
  orderNumber: string;
  field: string;
  cacheValue: unknown;
  dbValue: unknown;
};

export type ConsistencyReport = {
  checkedOrders: number;
  diffs: ConsistencyDiff[];
  consistent: boolean;
  cacheMisses: number;
  errors: string[];
};

const CACHE_PREFIX = "customer:context:";

function getCacheKey(phone: string): string {
  return `${CACHE_PREFIX}${phone.replace(/\D/g, "")}`;
}

export async function verifySingleOrderConsistency(
  phone: string,
  orderNumber: string
): Promise<ConsistencyDiff[]> {
  const diffs: ConsistencyDiff[] = [];

  const cached = await withRedis(async (redis) => {
    const raw = await redis.get(getCacheKey(phone));
    return raw ? JSON.parse(raw) : null;
  }, null);

  if (!cached) return diffs;

  const client = tryCreateAdminClient();
  const { data: dbOrder } = await client
    .from("orders")
    .select("order_status, payment_status, whatsapp_status")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!dbOrder) {
    return diffs;
  }

  const cachedOrder = cached.orders?.find(
    (o: { orderNumber: string }) => o.orderNumber === orderNumber
  );
  if (!cachedOrder) return diffs;

  const fieldsToCheck = ["orderStatus", "paymentStatus"] as const;
  const fieldMapping: Record<string, string> = {
    orderStatus: "order_status",
    paymentStatus: "payment_status",
  };

  for (const field of fieldsToCheck) {
    const cacheVal = cachedOrder[field];
    const dbField = fieldMapping[field];
    const dbVal = dbOrder[dbField as keyof typeof dbOrder];

    if (String(cacheVal ?? "") !== String(dbVal ?? "")) {
      diffs.push({
        orderNumber,
        field,
        cacheValue: cacheVal,
        dbValue: dbVal,
      });
    }
  }

  return diffs;
}

export async function verifyAllOrdersConsistency(phone: string): Promise<ConsistencyReport> {
  const report: ConsistencyReport = {
    checkedOrders: 0,
    diffs: [],
    consistent: true,
    cacheMisses: 0,
    errors: [],
  };

  const cached = await withRedis(async (redis) => {
    const raw = await redis.get(getCacheKey(phone));
    return raw ? JSON.parse(raw) : null;
  }, null);

  if (!cached) {
    report.cacheMisses = 1;
    report.consistent = true;
    return report;
  }

  const orders = cached.orders ?? [];
  if (!Array.isArray(orders) || orders.length === 0) {
    return report;
  }

  const client = tryCreateAdminClient();
  for (const order of orders) {
    try {
      const orderNumber = order.orderNumber;
      if (!orderNumber) continue;

      report.checkedOrders++;

      const { data: dbOrder } = await client
        .from("orders")
        .select("order_status, payment_status, whatsapp_status")
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (!dbOrder) {
        report.diffs.push({
          orderNumber: String(orderNumber),
          field: "exists",
          cacheValue: "present",
          dbValue: "not_found",
        });
        report.consistent = false;
        continue;
      }

      const fieldsToCheck = ["orderStatus", "paymentStatus"] as const;
      const fieldMapping: Record<string, string> = {
        orderStatus: "order_status",
        paymentStatus: "payment_status",
      };

      for (const field of fieldsToCheck) {
        const cacheVal = order[field];
        const dbField = fieldMapping[field];
        const dbVal = dbOrder[dbField as keyof typeof dbOrder];

        if (String(cacheVal ?? "") !== String(dbVal ?? "")) {
          report.diffs.push({
            orderNumber: String(orderNumber),
            field,
            cacheValue: cacheVal,
            dbValue: dbVal,
          });
          report.consistent = false;
        }
      }
    } catch (err) {
      report.errors.push(`Order ${order.orderNumber ?? "unknown"}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

export async function repairConsistencyDiff(phone: string, diff: ConsistencyDiff): Promise<boolean> {
  try {
    const client = tryCreateAdminClient();
    const { error } = await client
      .from("orders")
      .update({ [diff.field === "orderStatus" ? "order_status" : "payment_status"]: diff.dbValue })
      .eq("order_number", diff.orderNumber);

    if (error) return false;

    await withRedis(async (redis) => {
      const raw = await redis.get(getCacheKey(phone));
      if (!raw) return false;
      const cached = JSON.parse(raw);
      const orderIdx = cached.orders?.findIndex(
        (o: { orderNumber: string }) => o.orderNumber === diff.orderNumber
      );
      if (orderIdx !== undefined && orderIdx >= 0) {
        cached.orders[orderIdx][diff.field] = diff.dbValue;
        await redis.set(getCacheKey(phone), JSON.stringify(cached), "EX", 120);
      }
      return true;
    }, false);

    return true;
  } catch {
    return false;
  }
}

export async function invalidateCustomerCache(phone: string): Promise<boolean> {
  return withRedis(async (redis) => {
    await redis.del(getCacheKey(phone));
    return true;
  }, false);
}
