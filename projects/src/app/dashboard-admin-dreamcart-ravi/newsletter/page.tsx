import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Newsletter");
export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: subscribers } = await supabase
    .from("newsletter_subscriptions")
    .select("id, email, created_at")
    .order("created_at", { ascending: false });

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi/newsletter">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Audience</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Newsletter subscribers</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Track customers who want Vrixo updates, launches, and offers.
          </p>
        </div>
      </section>
      <div className="admin-table-card p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3">Email</th>
                <th className="py-3">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {(subscribers ?? []).map((subscriber) => (
                <tr key={subscriber.id} className="border-b border-slate-100">
                  <td className="py-4 font-medium text-slate-950">{subscriber.email}</td>
                  <td className="py-4">{new Date(subscriber.created_at).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
