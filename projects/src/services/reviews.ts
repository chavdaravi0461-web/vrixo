import { isSupabaseConfigured } from "@/lib/utils";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { Review } from "@/types/index";

function mapReview(row: Record<string, unknown>): Review {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    userId: String(row.user_id),
    rating: Number(row.rating ?? 0),
    title: String(row.title ?? ""),
    comment: String(row.comment ?? ""),
    createdAt: String(row.created_at),
    userName: String(row.user_name ?? "Customer")
  };
}

export async function getReviewsByProductId(productId: string) {
  if (!isSupabaseConfigured()) {
    return [] as Review[];
  }

  try {
    const supabase = createPublicSupabaseClient();
    const { data } = await supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => mapReview(row as Record<string, unknown>));
  } catch {
    return [] as Review[];
  }
}
