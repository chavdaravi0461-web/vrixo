import { AdminShell } from "@/components/admin/admin-shell";
import { ReviewsAdminClient } from "@/components/admin/reviews-admin-client";
import { buildMetadata } from "@/lib/metadata";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = buildMetadata("Admin Reviews");
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const reviewsResult = await supabase
    .from("product_reviews")
    .select("id, rating, title, comment, status, created_at, products(title)")
    .order("created_at", { ascending: false });
  const fallbackReviewsResult = reviewsResult.error
    ? await supabase
        .from("product_reviews")
        .select("id, rating, title, comment, created_at, products(title)")
        .order("created_at", { ascending: false })
    : null;
  const reviews = reviewsResult.data ?? fallbackReviewsResult?.data ?? [];

  return (
    <AdminShell>
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Trust Moderation</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Manage Reviews</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Approve useful product feedback and reject inappropriate reviews.</p>
        </div>
      </section>
      <ReviewsAdminClient reviews={reviews ?? []} />
    </AdminShell>
  );
}
