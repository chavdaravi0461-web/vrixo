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
    <AdminShell current="/dashboard-admin-dreamcart-ravi/reviews">
      <section className="admin-hero mb-6 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Trust moderation</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">Manage reviews</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
            Approve useful product feedback and reject reviews that should not appear on the customer store.
          </p>
        </div>
      </section>
      <ReviewsAdminClient reviews={reviews ?? []} />
    </AdminShell>
  );
}
