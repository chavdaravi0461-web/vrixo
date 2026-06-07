/**
 * Idempotency — prevents duplicate processing of identical requests.
 *
 * Supports configurable TTL for idempotency keys.
 * Uses in-flight dedup (first caller wins) + completed cache.
 *
 * Usage:
 *   const dedup = createIdempotencyGuard("order-create", 3600);
 *   const { isDuplicate, release } = await dedup.acquire("req-123");
 *   if (isDuplicate) return previousResponse;
 *   try { ... } finally { release(result); }
 */

import { coalesce } from "@/lib/request-coalescing";

type IdempotencyRecord = {
  status: "pending" | "completed" | "failed";
  result: unknown;
  createdAt: number;
};

export class IdempotencyGuard {
  private name: string;
  private ttlSeconds: number;
  private store = new Map<string, IdempotencyRecord>();
  private maxKeys: number;

  constructor(name: string, ttlSeconds = 3600, maxKeys = 5000) {
    this.name = name;
    this.ttlSeconds = ttlSeconds;
    this.maxKeys = maxKeys;
    this.startCleanup();
  }

  async acquire<T>(key: string): Promise<{
    isDuplicate: boolean;
    previousResult: T | null;
    commit: (result: T) => void;
    fail: (error: Error) => void;
  }> {
    const existing = this.store.get(key);
    if (existing) {
      if (existing.status === "completed") {
        return {
          isDuplicate: true,
          previousResult: existing.result as T,
          commit: () => {},
          fail: () => {},
        };
      }
      // Still pending — coalesce with in-flight
      return coalesce(`${this.name}:${key}`, async () => {
        const record = this.store.get(key);
        if (!record || record.status === "pending") {
          throw new Error("Idempotency key still pending");
        }
        return record.result as T;
      }).then((result) => ({
        isDuplicate: true,
        previousResult: result as T,
        commit: () => {},
        fail: () => {},
      }));
    }

    this.store.set(key, { status: "pending", result: null, createdAt: Date.now() });
    this.enforceMaxKeys();

    return {
      isDuplicate: false,
      previousResult: null,
      commit: (result: T) => {
        this.store.set(key, { status: "completed", result, createdAt: Date.now() });
      },
      fail: (error: Error) => {
        this.store.set(key, { status: "failed", result: error.message, createdAt: Date.now() });
      },
    };
  }

  private enforceMaxKeys(): void {
    if (this.store.size <= this.maxKeys) return;
    const entries = [...this.store.entries()];
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toDelete = this.store.size - this.maxKeys;
    for (let i = 0; i < toDelete; i++) {
      this.store.delete(entries[i][0]);
    }
  }

  private startCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.ttlSeconds * 1000;
      for (const [key, record] of this.store) {
        if (record.createdAt < cutoff) {
          this.store.delete(key);
        }
      }
    }, Math.min(this.ttlSeconds * 1000, 60_000));
  }

  getStats() {
    return {
      name: this.name,
      keys: this.store.size,
      maxKeys: this.maxKeys,
      ttlSeconds: this.ttlSeconds,
    };
  }
}

export const orderIdempotency = new IdempotencyGuard("order-create", 3600, 5000);
export const webhookIdempotency = new IdempotencyGuard("webhook", 300, 2000);
export const whatsappIdempotency = new IdempotencyGuard("whatsapp-msg", 60, 1000);
