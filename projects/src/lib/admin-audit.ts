import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { getClientIp, getUserAgent } from "@/lib/rate-limit";

type AuditInput = {
  request?: Request;
  adminUserId?: string | null;
  adminEmail?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAdminAudit(input: AuditInput) {
  const row = {
    admin_user_id: input.adminUserId ?? null,
    admin_email: input.adminEmail ?? null,
    action: input.action,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    ip_address: input.request ? getClientIp(input.request) : null,
    user_agent: input.request ? getUserAgent(input.request) : null,
    metadata: input.metadata ?? {}
  };

  if (!hasServerSupabaseAdminEnv()) {
    console.info("[admin-audit]", row);
    return;
  }

  try {
    await createAdminClient().from("admin_audit_logs").insert(row);
  } catch {
    console.info("[admin-audit]", row);
  }
}
