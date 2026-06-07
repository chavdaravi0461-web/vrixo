import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { processReturnAction } from "@/lib/orders/return-flow";
import { logAdminAudit } from "@/lib/admin-audit";
import { safeRoute } from "@/lib/safe-route";

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = safeRoute(async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await context.params;
  const body = await request.json();
  const { action, ...extra } = body;

  const validActions = ["approve", "reject", "schedule_pickup", "mark_received", "process_refund", "complete"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ message: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const result = await processReturnAction(id, action, guard.admin.user.id, extra);

  if (!result.success) {
    return NextResponse.json({ message: result.error || "Failed to process return." }, { status: 500 });
  }

  void logAdminAudit({
    action: `return_${action}`,
    targetTable: "return_requests",
    targetId: id,
    metadata: { action, adminId: guard.admin.user.id, ...extra },
  });

  return NextResponse.json({ message: `Return ${action}d successfully.` });
});
