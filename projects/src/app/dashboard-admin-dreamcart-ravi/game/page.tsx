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
  const validSessions = sessions?.filter((session) => session.is_valid).length ?? 0;
  const invalidSessions = (sessions?.length ?? 0) - validSessions;
  const usedCoupons = coupons?.filter((coupon) => coupon.used).length ?? 0;

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi/game">
      <section className="admin-hero p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Rewards engine</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Delivery Rush analytics</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Monitor valid game sessions, flagged attempts, and reward coupon usage.
          </p>
        </div>
      </section>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Sessions" value={sessions?.length ?? 0} />
        <Stat label="Valid" value={validSessions} />
        <Stat label="Flagged" value={invalidSessions} />
        <Stat label="Coupons used" value={usedCoupons} />
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section className="admin-table-card p-6">
          <h2 className="text-2xl font-black text-slate-950">Recent game sessions</h2>
          <div className="mt-5 space-y-3">
            {sessions?.map((session) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-bold text-slate-950">Score {session.score} / {session.reward_tier}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {session.mode} / {session.duration_seconds}s / {session.is_valid ? "valid" : "flagged"}
                </p>
                {!session.is_valid ? <p className="mt-1 text-xs text-red-600">{session.invalid_reason}</p> : null}
              </div>
            ))}
          </div>
        </section>
        <section className="admin-table-card p-6">
          <h2 className="text-2xl font-black text-slate-950">Game coupons</h2>
          <div className="mt-5 space-y-3">
            {coupons?.map((coupon) => (
              <div key={coupon.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-bold text-slate-950">{coupon.code}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {coupon.discount_type} / {coupon.used ? "used" : "unused"} / min Rs.{" "}
                  {coupon.min_order_value ?? coupon.min_order_amount ?? 0}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-kpi p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
