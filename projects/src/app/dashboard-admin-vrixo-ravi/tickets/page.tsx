import { AdminShell } from "@/components/admin/admin-shell";
import { TicketsAdminClient } from "@/components/admin/tickets-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { getTickets } from "@/lib/support/tickets";

export const metadata = buildMetadata("Support Tickets — VRIXO Admin");
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const tickets = await getTickets({ limit: 100 });

  return (
    <AdminShell>
      <section className="cos-section" style={{ marginBottom: "16px" }}>
        <div className="cos-section-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="cos-section-eyebrow">Support</span>
            </div>
            <h1 className="cos-section-title" style={{ fontSize: "18px" }}>Support Tickets</h1>
            <p className="cos-section-sub">Manage customer support tickets, replies, and escalations.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="cos-pill cos-pill-live">Live</span>
          </div>
        </div>
      </section>
      <TicketsAdminClient initialTickets={tickets} />
    </AdminShell>
  );
}
