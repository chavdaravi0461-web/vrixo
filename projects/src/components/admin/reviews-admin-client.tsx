"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type AdminReview = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status?: string | null;
  created_at: string;
  products?: { title?: string | null } | Array<{ title?: string | null }> | null;
};

export function ReviewsAdminClient({ reviews }: { reviews: AdminReview[] }) {
  async function updateStatus(id: string, status: "approved" | "rejected") {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(payload?.message ?? "Review update failed.");
      return;
    }

    toast.success("Review updated.");
    location.reload();
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="os-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--os-text-3)]">
                {getProductTitle(review.products)} - {review.rating}/5 - {review.status ?? "pending"}
              </p>
              <h2 className="mt-2 text-base font-bold text-[var(--os-text)]">
                {review.title || "Customer review"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--os-text-2)]">{review.comment}</p>
              <p className="mt-2 text-[10px] text-[var(--os-text-3)]">
                {new Date(review.created_at).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="rounded-2xl" onClick={() => updateStatus(review.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => updateStatus(review.id, "rejected")}>
                Reject
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getProductTitle(products: AdminReview["products"]) {
  if (Array.isArray(products)) {
    return products[0]?.title ?? "Product";
  }

  return products?.title ?? "Product";
}
