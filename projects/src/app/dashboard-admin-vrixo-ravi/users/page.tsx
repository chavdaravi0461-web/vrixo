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
    <AdminShell current="/dashboard-admin-vrixo-ravi/users">
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Customers</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Users</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Review registered customer profiles and admin/customer roles.</p>
        </div>
      </section>
      <div className="os-card">
        <div className="overflow-x-auto">
          <table className="os-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="text-sm font-medium text-[var(--os-text)]">{user.name}</td>
                  <td className="text-sm text-[var(--os-text-2)]">{user.email ?? "—"}</td>
                  <td className="text-sm text-[var(--os-text-2)]">{user.phone}</td>
                  <td>
                    <span className={`os-badge ${user.role === "admin" ? "os-badge-info" : "os-badge-gray"}`}>{user.role}</span>
                  </td>
                  <td className="text-sm text-[var(--os-text-3)]">{new Date(user.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
