import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

const allowedStatuses = new Set(["new", "read", "resolved"]);

const updateContactSchema = z.object({
  status: z.enum(["new", "read", "resolved"]),
  reply: z.string().optional().nullable(),
});

export const PATCH = safeRoute(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminApi(request);
  if (authError) return authError;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid contact data." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: parsed.data.status })
    .eq("id", id);

  if (error) {
    console.error("Contact update error:", error);
    return serverError();
  }

  return NextResponse.json({ message: "Contact updated." });
});
