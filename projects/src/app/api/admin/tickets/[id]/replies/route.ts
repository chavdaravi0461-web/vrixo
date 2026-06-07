import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { addTicketReply } from "@/lib/support/tickets";
import { safeRoute } from "@/lib/safe-route";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = safeRoute(async function POST(request: Request, context: RouteContext) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await context.params;
  const body = await request.json();
  const { message, internalNote } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ message: "Message is required." }, { status: 400 });
  }

  const result = await addTicketReply(id, {
    authorName: "Admin",
    authorRole: "admin",
    isAdmin: true,
    message: message.trim(),
    internalNote: Boolean(internalNote),
  });

  if (!result.success) {
    return NextResponse.json({ message: result.error || "Failed to add reply." }, { status: 500 });
  }

  return NextResponse.json({ message: "Reply added." });
});
