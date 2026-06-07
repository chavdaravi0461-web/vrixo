import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

const allowedStatuses = new Set(["new", "read", "resolved"]);

export const PATCH = safeRoute(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminApi(request);
  if (authError) return authError;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ message: "Invalid contact status." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: body.status })
    .eq("id", id);

  if (error) {
    console.error("Contact update error:", error);
    return serverError();
  }

  return NextResponse.json({ message: "Contact updated." });
});
