import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";
import { publishEvent } from "@/lib/event-bus";
import { executeWithLock } from "@/lib/distributed-lock";
import { createWalEntry, commitWalEntry, rollbackWalEntry } from "@/lib/write-ahead-log";

interface StockReservation {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  orderId: string;
  status: "active" | "confirmed" | "released" | "expired";
  createdAt: string;
  expiresAt: string;
}

interface InventorySnapshot {
  productId: string;
  sku?: string;
  title: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

const RESERVATION_TTL_SECONDS = 1800;
const LOW_STOCK_DEFAULT_THRESHOLD = 5;
const INVENTORY_CACHE_PREFIX = "inventory:";

export class InventoryGrid {
  async reserveStock(
    productId: string,
    quantity: number,
    orderId: string,
    options?: { ttlSeconds?: number; variantId?: string },
  ): Promise<{ success: boolean; error?: string; reservationId?: string }> {
    const lockResult = await executeWithLock(
      `stock:${productId}${options?.variantId ? `:${options.variantId}` : ""}`,
      async () => {
        const currentStock = await this.getCurrentStock(productId);
        if (currentStock === null) {
          return { success: false, error: "Product not found" };
        }

        const reserved = await this.getReservedCount(productId);
        const available = currentStock - reserved;

        if (available < quantity) {
          return { success: false, error: `Insufficient stock: ${available} available, ${quantity} requested` };
        }

        const reservationId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (options?.ttlSeconds ?? RESERVATION_TTL_SECONDS) * 1000).toISOString();

        await withRedis(async (redis) => {
          const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${productId}`;
          await redis.hset(reservationsKey, reservationId, JSON.stringify({
            id: reservationId,
            productId,
            variantId: options?.variantId,
            quantity,
            orderId,
            status: "active",
            createdAt: new Date().toISOString(),
            expiresAt,
          }));
          await redis.expire(reservationsKey, options?.ttlSeconds ?? RESERVATION_TTL_SECONDS);
          await redis.setex(`${INVENTORY_CACHE_PREFIX}snapshot:${productId}`, 30, JSON.stringify({
            totalStock: currentStock,
            reservedStock: reserved + quantity,
            availableStock: currentStock - reserved - quantity,
          }));
          return true;
        }, false);

        logInfo("inventory.reserved", { productId, quantity, orderId, reservationId, available: currentStock - reserved - quantity });
        return { success: true, reservationId };
      },
      { ttlSeconds: 10, retryCount: 5 },
    );

    if (!lockResult.success) {
      return { success: false, error: lockResult.error };
    }
    return lockResult.data;
  }

  async confirmReservation(reservationId: string, productId: string): Promise<boolean> {
    const walEntry = await createWalEntry("stock.decrement", "product", productId, {
      reservationId,
      productId,
      action: "confirm_reservation",
    });

    const result = await executeWithLock(
      `stock:${productId}`,
      async () => {
        const reservation = await this.getReservation(productId, reservationId);
        if (!reservation || reservation.status !== "active") {
          return false;
        }

        const supabase = createAdminClient();
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", productId)
          .single();

        if (!product) return false;

        const nextStock = Number(product.stock) - reservation.quantity;
        if (nextStock < 0) return false;

        const { error } = await supabase
          .from("products")
          .update({ stock: nextStock })
          .eq("id", productId)
          .gte("stock", reservation.quantity);

        if (error) return false;

        await withRedis(async (redis) => {
          const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${productId}`;
          await redis.hset(reservationsKey, reservationId, JSON.stringify({ ...reservation, status: "confirmed" }));
          await redis.del(`${INVENTORY_CACHE_PREFIX}snapshot:${productId}`);
          return true;
        }, false);

        return true;
      },
      { ttlSeconds: 10, retryCount: 5 },
    );

    if (result.success && result.data) {
      await commitWalEntry(walEntry.id, { stockDecremented: true });
      await publishEvent({
        type: "order.confirmed",
        severity: "info",
        entityId: reservationId,
        entityType: "inventory",
        payload: { productId, action: "reservation_confirmed", traceId: getTraceId() },
      });
      return true;
    }

    await rollbackWalEntry(walEntry.id, "reservation_confirm_failed");
    return false;
  }

  async releaseReservation(reservationId: string, productId: string): Promise<boolean> {
    return executeWithLock(
      `stock:${productId}`,
      async () => {
        const reservation = await this.getReservation(productId, reservationId);
        if (!reservation) return false;

        await withRedis(async (redis) => {
          const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${productId}`;
          await redis.hdel(reservationsKey, reservationId);
          await redis.del(`${INVENTORY_CACHE_PREFIX}snapshot:${productId}`);
          return true;
        }, false);

        logInfo("inventory.reservation_released", { productId, reservationId, quantity: reservation.quantity });
        return true;
      },
      { ttlSeconds: 5 },
    ).then((r) => r.success && r.data);
  }

  async getProductInventory(productId: string): Promise<InventorySnapshot | null> {
    const cached = await withRedis(async (redis) => {
      const raw = await redis.get(`${INVENTORY_CACHE_PREFIX}snapshot:${productId}`);
      return raw ? (JSON.parse(raw) as InventorySnapshot) : null;
    }, null as InventorySnapshot | null);

    if (cached) return cached;

    const supabase = createAdminClient();
    const { data: product } = await supabase
      .from("products")
      .select("id, title, stock, sku")
      .eq("id", productId)
      .single();

    if (!product) return null;

    const totalStock = Number(product.stock ?? 0);
    const reserved = await this.getReservedCount(productId);
    const available = totalStock - reserved;
    const threshold = LOW_STOCK_DEFAULT_THRESHOLD;

    const snapshot: InventorySnapshot = {
      productId: product.id,
      sku: product.sku ?? undefined,
      title: product.title,
      totalStock,
      reservedStock: reserved,
      availableStock: Math.max(0, available),
      lowStockThreshold: threshold,
      isLowStock: available > 0 && available <= threshold,
      isOutOfStock: available <= 0,
    };

    await withRedis(async (redis) => {
      await redis.setex(`${INVENTORY_CACHE_PREFIX}snapshot:${productId}`, 30, JSON.stringify(snapshot));
      return true;
    }, false);

    return snapshot;
  }

  async getLowStockProducts(threshold?: number): Promise<InventorySnapshot[]> {
    const supabase = createAdminClient();
    const t = threshold ?? LOW_STOCK_DEFAULT_THRESHOLD;

    const { data: products } = await supabase
      .from("products")
      .select("id, title, stock, sku")
      .lte("stock", t)
      .order("stock", { ascending: true })
      .limit(200);

    if (!products) return [];

    const results: InventorySnapshot[] = [];
    for (const product of products) {
      const reserved = await this.getReservedCount(product.id);
      const totalStock = Number(product.stock ?? 0);
      const available = totalStock - reserved;
      results.push({
        productId: product.id,
        title: product.title,
        sku: product.sku ?? undefined,
        totalStock,
        reservedStock: reserved,
        availableStock: Math.max(0, available),
        lowStockThreshold: t,
        isLowStock: available > 0 && available <= t,
        isOutOfStock: available <= 0,
      });
    }
    return results;
  }

  async getBulkInventory(productIds: string[]): Promise<Map<string, InventorySnapshot>> {
    const result = new Map<string, InventorySnapshot>();
    const batchSize = 50;

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const promises = batch.map((id) => this.getProductInventory(id));
      const snapshots = await Promise.all(promises);
      for (const snapshot of snapshots) {
        if (snapshot) result.set(snapshot.productId, snapshot);
      }
    }

    return result;
  }

  async recoverExpiredReservations(): Promise<number> {
    const supabase = createAdminClient();
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .limit(1000);

    if (!products) return 0;

    let recovered = 0;
    const now = Date.now();

    for (const product of products) {
      const reservations = await withRedis(async (redis) => {
        const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${product.id}`;
        const entries = await redis.hgetall(reservationsKey);
        return Object.entries(entries).map(([id, raw]) => ({
          id,
          data: JSON.parse(raw) as StockReservation,
        }));
      }, [] as Array<{ id: string; data: StockReservation }>);

      for (const { id, data } of reservations) {
        if (data.status === "active" && new Date(data.expiresAt).getTime() < now) {
          await this.releaseReservation(id, product.id);
          recovered++;
        }
      }
    }

    if (recovered > 0) {
      logInfo("inventory.expired_reservations_recovered", { count: recovered });
    }

    return recovered;
  }

  private async getCurrentStock(productId: string): Promise<number | null> {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();
    return data ? Number(data.stock) : null;
  }

  private async getReservedCount(productId: string): Promise<number> {
    return withRedis(async (redis) => {
      const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${productId}`;
      const entries = await redis.hgetall(reservationsKey);
      let total = 0;
      for (const raw of Object.values(entries)) {
        const res = JSON.parse(raw) as StockReservation;
        if (res.status === "active") total += res.quantity;
      }
      return total;
    }, 0);
  }

  private async getReservation(productId: string, reservationId: string): Promise<StockReservation | null> {
    return withRedis(async (redis) => {
      const reservationsKey = `${INVENTORY_CACHE_PREFIX}reservations:${productId}`;
      const raw = await redis.hget(reservationsKey, reservationId);
      return raw ? (JSON.parse(raw) as StockReservation) : null;
    }, null as StockReservation | null);
  }
}

export const inventoryGrid = new InventoryGrid();
