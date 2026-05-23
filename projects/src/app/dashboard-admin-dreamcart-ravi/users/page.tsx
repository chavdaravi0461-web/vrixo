import { AdminShell } from "@/components/admin/admin-shell";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Users");
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, name, email, role, phone, created_at")
    .order("created_at", { ascending: false });

  return (
    <AdminShell current="/dashboard-admin-dreamcart-ravi/users">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Customers</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Users</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Review registered customer profiles and admin/customer roles.
          </p>
        </div>
      </section>
      <div className="admin-table-card p-6">
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3">Name</th>
                <th className="py-3">Email</th>
                <th className="py-3">Phone</th>
                <th className="py-3">Role</th>
                <th className="py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-4">{user.name}</td>
                  <td className="py-4">{user.email ?? "No email saved"}</td>
                  <td className="py-4">{user.phone}</td>
                  <td className="py-4">{user.role}</td>
                  <td className="py-4">{new Date(user.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
