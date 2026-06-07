import { AdminShell } from "@/components/admin/admin-shell";
import { ProductAdminClient } from "@/components/admin/product-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Products");
export const dynamic = "force-dynamic";

const productSelect =
  "id, title, slug, category, subcategory, brand, price, original_price, discount_percent, stock, sku, images, featured, bestseller, new_arrival, status, created_at";

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = getPositiveInt(params.page, 1);
  const limit = Math.min(getPositiveInt(params.limit, 20), 50);
  const search = getString(params.search)?.trim();
  const status = getString(params.status);
  const category = getString(params.category);
  const sort = getString(params.sort) ?? "newest";
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = createAdminClient();

  let query = supabase
    .from("products")
    .select(productSelect, { count: "exact" });

  if (search) {
    const safeSearch = search.replace(/[%_,]/g, "");
    query = query.or(`title.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%,brand.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (sort === "price-asc") {
    query = query.order("price", { ascending: true });
  } else if (sort === "price-desc") {
    query = query.order("price", { ascending: false });
  } else if (sort === "stock-asc") {
    query = query.order("stock", { ascending: true });
  } else if (sort === "stock-desc") {
    query = query.order("stock", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const [{ data, count }, activeCount, draftCount, lowStockCount] = await Promise.all([
    query.range(from, to),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("products").select("id", { count: "exact", head: true }).lte("stock", 5).eq("status", "active")
  ]);
  const total = count ?? 0;

  return (
    <AdminShell current="/dashboard-admin-vrixo-ravi/products">
      <ProductAdminClient
        products={(data ?? []).map(mapAdminProduct)}
        pagination={{ page, limit, total }}
        filters={{
          search: search ?? "",
          status: status ?? "all",
          category: category ?? "all",
          sort
        }}
        stats={{
          total,
          active: activeCount.count ?? 0,
          draft: draftCount.count ?? 0,
          lowStock: lowStockCount.count ?? 0
        }}
      />
    </AdminShell>
  );
}

function mapAdminProduct(row: Record<string, unknown>) {
  const images = Array.isArray(row.images) ? (row.images as string[]) : [];
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    category: String(row.category ?? ""),
    subcategory: String(row.subcategory ?? ""),
    brand: String(row.brand ?? ""),
    price: Number(row.price ?? 0),
    originalPrice: Number(row.original_price ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    stock: Number(row.stock ?? 0),
    sku: String(row.sku ?? ""),
    image: images[0] ?? "",
    featured: Boolean(row.featured),
    bestseller: Boolean(row.bestseller),
    newArrival: Boolean(row.new_arrival),
    highlighted: Boolean(row.highlighted),
    status: String(row.status ?? "active") as "active" | "draft" | "archived",
    createdAt: String(row.created_at ?? "")
  };
}

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(getString(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}
