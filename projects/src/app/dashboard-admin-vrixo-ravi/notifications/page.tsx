import { AdminShell } from "@/components/admin/admin-shell";
import { NotificationsAdminClient } from "@/components/admin/notifications-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";

export const metadata = buildMetadata("Admin Notifications");
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdmin();

  return (
    <AdminShell>
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Notifications</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Notification Logs</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
            WhatsApp delivery logs, failed notifications, and manual resend tools.
          </p>
        </div>
      </section>
      <NotificationsAdminClient />
    </AdminShell>
  );
}
