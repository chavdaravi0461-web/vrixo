import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";

const allowedStatuses = new Set(["pending", "approved", "rejected"]);

export async function PATCH(
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
    return NextResponse.json({ message: "Invalid review status." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("product_reviews")
    .update({ status: body.status })
    .eq("id", id);

  if (error) {
    return serverError();
  }

  return NextResponse.json({ message: "Review updated." });
}
