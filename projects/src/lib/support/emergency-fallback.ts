import "server-only";
import { withRedis } from "@/lib/redis";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/utils";
import { logWarn, logError, logInfo } from "@/lib/observability";
import { publishEvent } from "@/lib/event-bus";
import type { SupportIntent } from "./types";
import { DESTRUCTIVE_INTENTS } from "./types";

export type EmergencyStatus = {
  destructiveActionsDisabled: boolean;
  reason: string | null;
  dbAvailable: boolean;
  contextAvailable: boolean;
  lastChecked: string;
  degradedSince: string | null;
};

let cachedStatus: EmergencyStatus | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 30_000;
const DEGRADE_THRESHOLD_MS = 10_000;

export function isDestructiveIntent(intent: string): boolean {
  return DESTRUCTIVE_INTENTS.includes(intent as SupportIntent);
}

async function checkDatabaseHealth(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = tryCreateAdminClient();
    if (!supabase) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const { error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);
    return !error;
  } catch {
    return false;
  }
}

async function checkContextHealth(): Promise<boolean> {
  const redisAvailable = await withRedis(async () => true, false);
  return redisAvailable;
}

export async function getEmergencyStatus(
  forceRefresh = false,
): Promise<EmergencyStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return cachedStatus;
  }

  const dbAvailable = await checkDatabaseHealth();
  const contextAvailable = await checkContextHealth();
  const destructiveActionsDisabled = !dbAvailable || !contextAvailable;

  let reason: string | null = null;
  if (!dbAvailable && !contextAvailable) {
    reason = "Database and context store unavailable";
  } else if (!dbAvailable) {
    reason = "Database unavailable";
  } else if (!contextAvailable) {
    reason = "Context store unavailable";
  }

  if (destructiveActionsDisabled && (!cachedStatus || !cachedStatus.destructiveActionsDisabled)) {
    logError("emergency.destructive_disabled", { reason, dbAvailable, contextAvailable });
    publishEvent({
      type: "system.anomaly",
      severity: "critical",
      entityType: "support",
      payload: {
        event: "destructive_disabled",
        reason,
        dbAvailable,
        contextAvailable,
      },
    }).catch(() => undefined);
  }

  if (!destructiveActionsDisabled && cachedStatus?.destructiveActionsDisabled) {
    logInfo("emergency.destructive_restored", { reason: "System recovered" });
    publishEvent({
      type: "system.anomaly",
      severity: "info",
      entityType: "support",
      payload: {
        event: "destructive_restored",
        reason: "System recovered",
      },
    }).catch(() => undefined);
  }

  cachedStatus = {
    destructiveActionsDisabled,
    reason,
    dbAvailable,
    contextAvailable,
    lastChecked: new Date(now).toISOString(),
    degradedSince: destructiveActionsDisabled
      ? (cachedStatus?.degradedSince ?? new Date(now).toISOString())
      : null,
  };
  lastCheckTime = now;

  return cachedStatus;
}

export async function checkDestructiveAllowed(
  intent: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!isDestructiveIntent(intent)) {
    return { allowed: true };
  }

  const status = await getEmergencyStatus();
  if (status.destructiveActionsDisabled) {
    logWarn("emergency.destructive_blocked", {
      intent,
      reason: status.reason,
    });
    return {
      allowed: false,
      reason: status.reason ?? "Service temporarily unavailable for destructive actions",
    };
  }

  return { allowed: true };
}

export function getDegradationDuration(): number | null {
  if (!cachedStatus?.degradedSince) return null;
  return Date.now() - new Date(cachedStatus.degradedSince).getTime();
}

export function resetCachedStatus(): void {
  cachedStatus = null;
  lastCheckTime = 0;
}
