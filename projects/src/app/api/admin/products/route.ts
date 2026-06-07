import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";
import { buildProductPayload } from "@/lib/admin/product-payload";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const body = (await request.json()) as Record<string, unknown>;
  const { payload, errors } = buildProductPayload(body);

  if (errors.length > 0) {
    return NextResponse.json({ message: errors[0], errors }, { status: 400 });
  }

  const supabase = createAdminClient();
  const duplicate = await supabase
    .from("products")
    .select("id, slug, sku")
    .or(`slug.eq.${payload.slug},sku.eq.${payload.sku}`)
    .maybeSingle();

  if (duplicate.data) {
    return NextResponse.json(
      { message: "A product with this slug or SKU already exists." },
      { status: 409 }
    );
  }

  const insertPayload = { ...payload };
  delete (insertPayload as Partial<typeof payload>).highlighted;
  const { data, error } = await supabase.from("products").insert(insertPayload).select("id, slug").single();

  if (error) {
    return serverError();
  }

  await logAdminAudit({
    request,
    adminUserId: guard.admin.user.id,
    adminEmail: guard.admin.user.email,
    action: "product.create",
    targetTable: "products",
    targetId: data.id,
    metadata: { slug: data.slug }
  });

  const { invalidateProductCache } = await import("@/services/products");
  await invalidateProductCache();

  return NextResponse.json({ message: "Product created successfully.", product: data });
});
