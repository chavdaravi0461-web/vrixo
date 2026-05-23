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
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi/coupons">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Growth tools</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Coupons</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Create controlled offers for conversion without cluttering the customer storefront.
          </p>
        </div>
      </section>
      <CouponsAdminClient coupons={coupons ?? []} />
    </AdminShell>
  );
}
