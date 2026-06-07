import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Game Rewards");
export const dynamic = "force-dynamic";

export default async function AdminGamePage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: sessions }, { data: coupons }] = await Promise.all([
    supabase
      .from("game_sessions")
      .select("id, score, reward_tier, mode, duration_seconds, is_valid, invalid_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("coupons")
      .select("id, code, discount_type, used, min_order_value, min_order_amount, created_at")
      .eq("source", "game")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const validSessions = sessions?.filter((s) => s.is_valid).length ?? 0;
  const invalidSessions = (sessions?.length ?? 0) - validSessions;
  const usedCoupons = coupons?.filter((c) => c.used).length ?? 0;

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/game">
      <section className="os-hero p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Rewards Engine</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Delivery Rush</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Monitor game sessions, flagged attempts, and reward coupon usage.</p>
        </div>
      </section>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Sessions" value={sessions?.length ?? 0} />
        <Stat label="Valid" value={validSessions} />
        <Stat label="Flagged" value={invalidSessions} />
        <Stat label="Coupons used" value={usedCoupons} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Recent Game Sessions</h3>
              <p>Last 100 attempts</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--os-border)]">
            {sessions?.map((session) => (
              <div key={session.id} className="os-row flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-[var(--os-text)]">Score {session.score} / {session.reward_tier}</p>
                  <p className="text-[10px] text-[var(--os-text-3)]">{session.mode} / {session.duration_seconds}s</p>
                  {!session.is_valid && <p className="text-[10px] text-[var(--os-danger)] mt-0.5">{session.invalid_reason}</p>}
                </div>
                <span className={`os-badge ${session.is_valid ? "os-badge-success" : "os-badge-danger"}`}>
                  {session.is_valid ? "valid" : "flagged"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="os-card">
          <div className="os-card-header">
            <div>
              <h3>Game Coupons</h3>
              <p>Rewards generated</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--os-border)]">
            {coupons?.map((coupon) => (
              <div key={coupon.id} className="os-row flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-[var(--os-text)]">{coupon.code}</p>
                  <p className="text-[10px] text-[var(--os-text-3)]">{coupon.discount_type} / min ₹{coupon.min_order_value ?? coupon.min_order_amount ?? 0}</p>
                </div>
                <span className={`os-badge ${coupon.used ? "os-badge-gray" : "os-badge-success"}`}>
                  {coupon.used ? "used" : "unused"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="os-metric">
      <div className="m-top">
        <div>
          <div className="m-label">{label}</div>
          <div className="m-value">{value}</div>
        </div>
      </div>
    </div>
  );
}
