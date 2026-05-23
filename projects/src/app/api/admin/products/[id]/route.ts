import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";
import { buildProductPayload } from "@/lib/admin/product-payload";
import { logAdminAudit } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";
import { mapProductRow } from "@/services/products";

const PRODUCT_DETAIL_SELECT =
  "id, slug, title, category, subcategory, brand, short_description, full_description, price, original_price, discount_percent, currency, stock, sku, sizes, colors, images, featured, bestseller, new_arrival, status, rating, review_count, specifications, created_at, updated_at";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ product: mapProductRow(data as Record<string, unknown>) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const body = (await request.json()) as Record<string, unknown>;
  const { id } = await params;

  if (body.partial === true) {
    const update: Record<string, unknown> = {};
    if (body.status === "active" || body.status === "draft" || body.status === "archived") {
      update.status = body.status;
    }
    if (typeof body.featured === "boolean") update.featured = body.featured;
    if (body.stock !== undefined) {
      const stock = Math.max(0, Math.trunc(Number(body.stock)));
      if (!Number.isFinite(stock)) {
        return NextResponse.json({ message: "Stock must be numeric." }, { status: 400 });
      }
      update.stock = stock;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No supported quick update fields sent." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("products").update(update).eq("id", id);

    if (error) {
      return serverError();
    }

    await logAdminAudit({
      request,
      adminUserId: guard.admin.user.id,
      adminEmail: guard.admin.user.email,
      action: "product.update",
      targetTable: "products",
      targetId: id,
      metadata: { fields: Object.keys(update) }
    });

    return NextResponse.json({ message: "Product updated successfully." });
  }

  const { payload, errors } = buildProductPayload(body);

  if (errors.length > 0) {
    return NextResponse.json({ message: errors[0], errors }, { status: 400 });
  }

  const supabase = createAdminClient();
  const duplicate = await supabase
    .from("products")
    .select("id")
    .or(`slug.eq.${payload.slug},sku.eq.${payload.sku}`)
    .neq("id", id)
    .limit(1);

  if (duplicate.data?.length) {
    return NextResponse.json(
      { message: "Another product already uses this slug or SKU." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("products").update(payload).eq("id", id);

  if (error) {
    return serverError();
  }

  await logAdminAudit({
    request,
    adminUserId: guard.admin.user.id,
    adminEmail: guard.admin.user.email,
    action: "product.update",
    targetTable: "products",
    targetId: id
  });

  return NextResponse.json({ message: "Product updated successfully." });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { id } = await params;
  const supabase = createAdminClient();
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  if (permanent) {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      const isReferenceError =
        error.code === "23503" ||
        error.message.toLowerCase().includes("foreign key") ||
        error.message.toLowerCase().includes("violates");

      return NextResponse.json(
        {
          message: isReferenceError
            ? "This product is linked to existing orders. Archive it instead to hide it from the website while keeping order history safe."
            : "Product could not be deleted."
        },
        { status: isReferenceError ? 409 : 500 }
      );
    }

    await logAdminAudit({
      request,
      adminUserId: guard.admin.user.id,
      adminEmail: guard.admin.user.email,
      action: "product.permanent_delete",
      targetTable: "products",
      targetId: id,
      metadata: { mode: "permanent" }
    });

    return NextResponse.json({ message: "Product permanently deleted." });
  }

  const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);

  if (error) {
    return serverError();
  }

  await logAdminAudit({
    request,
    adminUserId: guard.admin.user.id,
    adminEmail: guard.admin.user.email,
    action: "product.delete",
    targetTable: "products",
    targetId: id,
    metadata: { mode: "archived" }
  });

  return NextResponse.json({ message: "Product deactivated successfully." });
}
