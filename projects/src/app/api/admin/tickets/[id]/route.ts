import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { getTicketById, getTicketReplies, updateTicketStatus } from "@/lib/support/tickets";
import { logAdminAudit } from "@/lib/admin-audit";
import { safeRoute } from "@/lib/safe-route";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = safeRoute(async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAdminApi(_request);
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ message: "Ticket not found." }, { status: 404 });
  }

  const replies = await getTicketReplies(id);
  return NextResponse.json({ ticket, replies });
});

export const PUT = safeRoute(async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await context.params;
  const body = await request.json();
  const { status, assignedTo, priority } = body;

  if (status) {
    const result = await updateTicketStatus(id, status);
    if (!result.success) {
      return NextResponse.json({ message: result.error || "Failed to update ticket." }, { status: 500 });
    }
  }

  void logAdminAudit({
    action: `update_ticket_${status ?? "metadata"}`,
    targetTable: "support_tickets",
    targetId: id,
    metadata: { status, assignedTo, priority, adminId: guard.admin?.user?.id },
  });

  return NextResponse.json({ message: "Ticket updated." });
});
