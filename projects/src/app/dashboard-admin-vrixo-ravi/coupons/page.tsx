import { AdminShell } from "@/components/admin/admin-shell";
import { CouponsAdminClient } from "@/components/admin/coupons-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Coupons");
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, description, discount_type, discount_value, min_order_amount, active, starts_at, ends_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/coupons">
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Growth Tools</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Coupons</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Create controlled offers for conversion.</p>
        </div>
      </section>
      <CouponsAdminClient coupons={coupons ?? []} />
    </AdminShell>
  );
}
