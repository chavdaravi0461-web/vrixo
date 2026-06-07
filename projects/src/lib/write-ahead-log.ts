import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { getTraceId } from "@/lib/trace-context";

export type WalOperation = "payment.capture" | "payment.verify" | "stock.decrement" | "order.status" | "coupon.mark";

export type WalEntry = {
  id: string;
  operation: WalOperation;
  status: "pending" | "committed" | "rolled_back" | "failed";
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  traceId: string;
  createdAt: string;
  committedAt?: string;
  rolledBackAt?: string;
};

const PENDING_EXPIRY_MS = 30_000;

export async function createWalEntry(
  operation: WalOperation,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<WalEntry> {
  const entry: WalEntry = {
    id: crypto.randomUUID(),
    operation,
    status: "pending",
    entityType,
    entityId,
    payload,
    traceId: getTraceId(),
    createdAt: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from("app_events").insert({
    id: entry.id,
    type: `wal.${operation}`,
    severity: "info",
    entity_id: entityId,
    entity_type: entityType,
    payload: { wal: true, operation, status: "pending", ...payload, traceId: entry.traceId },
    created_at: entry.createdAt,
  });

  if (error) {
    logError("wal.create_failed", { operation, entityType, entityId, error: error.message });
    throw new Error(`WAL create failed: ${error.message}`);
  }

  await withRedis(async (redis) => {
    await redis.setex(`wal:pending:${entry.id}`, 60, JSON.stringify(entry));
    return true;
  }, false);

  logInfo("wal.created", { operation, entityType, entityId, walId: entry.id });
  return entry;
}

export async function commitWalEntry(walId: string, result?: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_events")
    .update({ payload: { wal_committed: true, committed_at: now, result } })
    .eq("id", walId);

  if (error) {
    logError("wal.commit_failed", { walId, error: error.message });
    throw new Error(`WAL commit failed: ${error.message}`);
  }

  await withRedis(async (redis) => {
    await redis.del(`wal:pending:${walId}`);
    await redis.setex(`wal:committed:${walId}`, 86400 * 7, JSON.stringify({ walId, result, committedAt: now }));
    return true;
  }, false);

  logInfo("wal.committed", { walId });
}

export async function rollbackWalEntry(walId: string, error?: string): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error: dbError } = await supabase
    .from("app_events")
    .update({ payload: { wal_rolled_back: true, rolled_back_at: now, error } })
    .eq("id", walId);

  if (dbError) {
    logError("wal.rollback_failed", { walId, error: dbError.message });
  }

  await withRedis(async (redis) => {
    await redis.del(`wal:pending:${walId}`);
    await redis.setex(`wal:rolled_back:${walId}`, 86400 * 7, JSON.stringify({ walId, error, rolledBackAt: now }));
    return true;
  }, false);

  logWarn("wal.rolled_back", { walId, error });
}

export async function recoverOrphanedWalEntries(): Promise<number> {
  const supabase = createAdminClient();

  const cutoff = new Date(Date.now() - PENDING_EXPIRY_MS).toISOString();

  const { data: orphans, error } = await supabase
    .from("app_events")
    .select("id, type, entity_id, entity_type, created_at")
    .like("type", "wal.%")
    .lt("created_at", cutoff)
    .limit(50);

  if (error) {
    logError("wal.recover_query_failed", { error: error.message });
    return 0;
  }

  if (!orphans || orphans.length === 0) return 0;

  for (const orphan of orphans) {
    await rollbackWalEntry(orphan.id, "recovered_orphan_timeout");
    logWarn("wal.orphan_recovered", { walId: orphan.id, entityType: orphan.entity_type, entityId: orphan.entity_id });
  }

  return orphans.length;
}
