import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInfo, logWarn, logError } from "@/lib/observability";
import { publishEvent } from "@/lib/event-bus";
import { getAllCircuitStats } from "@/lib/circuit-breaker";
import { runHealthCheck } from "@/lib/health-system";
import { recoverOrphanedWalEntries } from "@/lib/write-ahead-log";
import { adaptThresholds } from "@/lib/adaptive-fraud";

interface HealingAction {
  name: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  execute: () => Promise<HealingActionResult>;
}

interface HealingActionResult {
  success: boolean;
  itemsHealed: number;
  itemsFailed: number;
  details: string[];
}

class HealingEngine {
  private actions: HealingAction[] = [];
  private healingInProgress = false;
  private lastHealingCycle: number = 0;
  private totalHealingActions: number = 0;
  private totalItemsHealed: number = 0;

  constructor() {
    this.registerDefaultActions();
  }

  private registerDefaultActions(): void {
    this.registerAction({
      name: "recover-stuck-whatsapp-sending",
      description: "Recovers orders stuck in whatsapp_status='sending' by resetting to 'pending' after 30 min timeout",
      severity: "high",
      execute: async () => {
        const supabase = createAdminClient();
        const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: stuck, error } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("whatsapp_status", "sending")
          .lt("updated_at", threshold)
          .limit(1000);

        if (error || !stuck || stuck.length === 0) {
          return { success: true, itemsHealed: 0, itemsFailed: 0, details: ["No stuck orders found"] };
        }

        let healed = 0;
        let failed = 0;
        const details: string[] = [];

        for (const order of stuck) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({ whatsapp_status: "pending" })
            .eq("id", order.id);

          if (updateError) {
            failed++;
            details.push(`Failed to recover order ${order.order_number}: ${updateError.message}`);
          } else {
            healed++;
            details.push(`Recovered order ${order.order_number} from stuck whatsapp_status`);
          }
        }

        return { success: failed === 0, itemsHealed: healed, itemsFailed: failed, details };
      },
    });

    this.registerAction({
      name: "recover-stuck-payment-pending",
      description: "Identifies orders stuck in payment_status='pending' > 2 hours and marks as abandoned",
      severity: "medium",
      execute: async () => {
        const supabase = createAdminClient();
        const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: stale, error } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("payment_status", "pending")
          .in("payment_method", ["online", "Online Payment"])
          .lt("created_at", threshold)
          .limit(1000);

        if (error || !stale || stale.length === 0) {
          return { success: true, itemsHealed: 0, itemsFailed: 0, details: ["No stale pending payments found"] };
        }

        let healed = 0;
        const details: string[] = [];
        for (const order of stale) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({ payment_status: "abandoned", order_status: "cancelled", notes: { abandoned_at: new Date().toISOString(), reason: "auto_abandon_payment_timeout" } })
            .eq("id", order.id);
          if (updateError) {
            details.push(`Failed to abandon order ${order.order_number}: ${updateError.message}`);
          } else {
            healed++;
            details.push(`Abandoned stale payment order ${order.order_number}`);
          }
        }

        return { success: true, itemsHealed: healed, itemsFailed: 0, details };
      },
    });

    this.registerAction({
      name: "recover-expired-coupons",
      description: "Releases coupons stuck in 'used' state for cancelled orders",
      severity: "medium",
      execute: async () => {
        const supabase = createAdminClient();
        const { data: orphaned, error } = await supabase
          .from("coupons")
          .select("id, code, order_id")
          .eq("used", true)
          .not("order_id", "is", null)
          .limit(1000);

        if (error || !orphaned || orphaned.length === 0) {
          return { success: true, itemsHealed: 0, itemsFailed: 0, details: ["No orphaned coupons found"] };
        }

        let healed = 0;
        const details: string[] = [];
        for (const coupon of orphaned) {
          const { data: order } = await supabase
            .from("orders")
            .select("order_status, payment_status")
            .eq("id", coupon.order_id)
            .maybeSingle();

          if (order && (order.order_status === "cancelled" || order.payment_status === "failed")) {
            const { error: updateError } = await supabase
              .from("coupons")
              .update({ used: false, order_id: null })
              .eq("id", coupon.id);
            if (!updateError) {
              healed++;
              details.push(`Released coupon ${coupon.code} from cancelled order`);
            }
          }
        }

        return { success: true, itemsHealed: healed, itemsFailed: 0, details };
      },
    });

    this.registerAction({
      name: "recover-orphan-payment-records",
      description: "Cleans up payment records without valid orders",
      severity: "low",
      execute: async () => {
        const supabase = createAdminClient();
        const { data: orphaned, error } = await supabase
          .from("payments")
          .select("id, order_id")
          .limit(500);

        if (error || !orphaned) {
          return { success: true, itemsHealed: 0, itemsFailed: 0, details: ["Query failed"] };
        }

        let healed = 0;
        const details: string[] = [];
        for (const payment of orphaned) {
          const { data: order } = await supabase
            .from("orders")
            .select("id")
            .eq("id", payment.order_id)
            .maybeSingle();
          if (!order) {
            const { error: delError } = await supabase.from("payments").delete().eq("id", payment.id);
            if (!delError) {
              healed++;
              details.push(`Removed orphan payment ${payment.id}`);
            }
          }
        }

        return { success: true, itemsHealed: healed, itemsFailed: 0, details };
      },
    });

    this.registerAction({
      name: "wal-recovery",
      description: "Recovers orphaned Write-Ahead Log entries that timed out",
      severity: "high",
      execute: async () => {
        const recovered = await recoverOrphanedWalEntries();
        return {
          success: true,
          itemsHealed: recovered,
          itemsFailed: 0,
          details: recovered > 0 ? [`Recovered ${recovered} orphaned WAL entries`] : ["No orphaned WAL entries"],
        };
      },
    });

    this.registerAction({
      name: "fraud-adaptive-training",
      description: "Adapts fraud thresholds based on rolling statistics",
      severity: "medium",
      execute: async () => {
        const thresholds = await adaptThresholds();
        return {
          success: true,
          itemsHealed: 0,
          itemsFailed: 0,
          details: [`Fraud thresholds adapted: block=${thresholds.blockScore}, review=${thresholds.reviewScore}`],
        };
      },
    });

    this.registerAction({
      name: "circuit-breaker-health",
      description: "Logs circuit breaker stats for monitoring",
      severity: "low",
      execute: async () => {
        const stats = getAllCircuitStats();
        const openCircuits: string[] = [];
        for (const [name, stat] of stats) {
          if (stat.state === "open") {
            openCircuits.push(`${name}(failures=${stat.failures})`);
          }
        }
        if (openCircuits.length > 0) {
          logWarn("healing.open_circuits", { circuits: openCircuits });
        }
        return {
          success: true,
          itemsHealed: 0,
          itemsFailed: 0,
          details: openCircuits.length > 0
            ? [`Open circuits detected: ${openCircuits.join(", ")}`]
            : ["All circuits closed"],
        };
      },
    });

    this.registerAction({
      name: "health-check-report",
      description: "Runs comprehensive health check and reports status",
      severity: "low",
      execute: async () => {
        const health = await runHealthCheck();
        if (health.status !== "healthy") {
          logWarn("healing.health_report", {
            status: health.status,
            degraded: health.degradedServices,
            failed: health.failedServices,
          });
        }
        return {
          success: true,
          itemsHealed: 0,
          itemsFailed: 0,
          details: [`System health: ${health.status}, ${health.degradedServices.length} degraded, ${health.failedServices.length} failed`],
        };
      },
    });
  }

  registerAction(action: HealingAction): void {
    this.actions.push(action);
  }

  async runHealingCycle(): Promise<{
    totalActions: number;
    totalHealed: number;
    totalFailed: number;
    results: Array<{ name: string; success: boolean; itemsHealed: number; itemsFailed: number; details: string[] }>;
  }> {
    if (this.healingInProgress) {
      return { totalActions: 0, totalHealed: 0, totalFailed: 0, results: [] };
    }

    this.healingInProgress = true;
    this.lastHealingCycle = Date.now();
    const results: Array<{ name: string; success: boolean; itemsHealed: number; itemsFailed: number; details: string[] }> = [];

    logInfo("healing.cycle_started", { actionCount: this.actions.length });

    for (const action of this.actions) {
      try {
        const result = await action.execute();
        results.push({ name: action.name, ...result });
        this.totalHealingActions++;
        this.totalItemsHealed += result.itemsHealed;

        if (result.itemsHealed > 0) {
          logInfo("healing.action_completed", {
            action: action.name,
            healed: result.itemsHealed,
            failed: result.itemsFailed,
          });

          publishEvent({
            type: "healing.action",
            severity: result.itemsFailed > 0 ? "warn" : "info",
            entityType: "system",
            payload: { action: action.name, healed: result.itemsHealed, failed: result.itemsFailed, details: result.details },
          }).catch(() => undefined);
        }
      } catch (error) {
        logError("healing.action_failed", {
          action: action.name,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({ name: action.name, success: false, itemsHealed: 0, itemsFailed: 1, details: [String(error)] });
      }
    }

    this.healingInProgress = false;

    logInfo("healing.cycle_completed", {
      totalActions: this.actions.length,
      totalHealed: results.reduce((s, r) => s + r.itemsHealed, 0),
      totalFailed: results.reduce((s, r) => s + r.itemsFailed, 0),
    });

    return {
      totalActions: this.actions.length,
      totalHealed: results.reduce((s, r) => s + r.itemsHealed, 0),
      totalFailed: results.reduce((s, r) => s + r.itemsFailed, 0),
      results,
    };
  }

  getStats() {
    return {
      totalHealingActions: this.totalHealingActions,
      totalItemsHealed: this.totalItemsHealed,
      lastHealingCycle: this.lastHealingCycle ? new Date(this.lastHealingCycle).toISOString() : null,
      healingInProgress: this.healingInProgress,
      registeredActions: this.actions.map((a) => ({ name: a.name, severity: a.severity })),
    };
  }
}

export const healingEngine = new HealingEngine();
