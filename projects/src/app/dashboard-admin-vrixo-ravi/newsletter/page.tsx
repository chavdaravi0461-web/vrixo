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
    <AdminShell>
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Audience</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Newsletter Subscribers</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Track customers who want updates, launches, and offers.</p>
        </div>
      </section>
      <div className="os-card">
        <div className="overflow-x-auto">
          <table className="os-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {(subscribers ?? []).map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="text-sm font-medium text-[var(--os-text)]">{subscriber.email}</td>
                  <td className="text-sm text-[var(--os-text-3)]">{new Date(subscriber.created_at).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
