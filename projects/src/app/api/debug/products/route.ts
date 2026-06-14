import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

const PRODUCT_LIST_SELECT = "id, slug, title, category, subcategory, brand, short_description, price, original_price, discount_percent, currency, stock, sizes, colors, images, featured, bestseller, new_arrival, rating, review_count, specifications";

export const GET = async () => {
  const checks: Record<string, unknown> = {};

  checks.supabaseConfigured = isSupabaseConfigured();
  checks.envUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  checks.envKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured", checks });
  }

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    checks.queryError = error?.message ?? null;
    checks.rowCount = data?.length ?? 0;
    checks.sampleColumns = data?.[0] ? Object.keys(data[0]) : [];
    checks.firstProduct = data?.[0] ? { id: data[0].id, title: data[0].title, slug: data[0].slug } : null;
    checks.totalProducts = data?.length ?? 0;

    return NextResponse.json({ success: !error, checks });
  } catch (err) {
    checks.exception = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, checks }, { status: 500 });
  }
};
