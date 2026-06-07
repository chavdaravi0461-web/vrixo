import { AdminShell } from "@/components/admin/admin-shell";
import { TicketsAdminClient } from "@/components/admin/tickets-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { getTickets } from "@/lib/support/tickets";

export const metadata = buildMetadata("Admin Support Tickets");
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const tickets = await getTickets({ limit: 100 });

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/tickets">
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Support</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Support Tickets</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">
            Manage customer support tickets, replies, and escalations.
          </p>
        </div>
      </section>
      <TicketsAdminClient initialTickets={tickets} />
    </AdminShell>
  );
}
