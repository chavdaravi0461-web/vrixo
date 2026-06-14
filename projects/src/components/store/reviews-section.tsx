"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, ShieldCheck } from "lucide-react";
import type { Review } from "@/types/index";

export function ReviewsSection({
  productId,
  reviews: initialReviews
}: {
  productId: string;
  reviews: Review[];
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !comment.trim()) { toast.error("Please fill in all fields."); return; }
    if (rating < 1 || rating > 5) { toast.error("Please select a rating from 1 to 5."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, title: title.trim(), comment: comment.trim(), rating })
      });
      const payload = await response.json();
      if (!response.ok) { toast.error(payload.message ?? "Failed to submit review."); return; }
      const newReview: Review = {
        id: `temp-${Date.now()}`,
        productId, userId: "", title: title.trim(), comment: comment.trim(), rating,
        userName: "You", createdAt: new Date().toISOString()
      };
      setReviews((prev) => [newReview, ...prev]);
      setTitle(""); setComment(""); setRating(5);
      toast.success("Review submitted for approval.");
    } catch {
      toast.error("Failed to submit review. Please check your connection.");
    } finally { setLoading(false); }
  }

  return (
    <section className="container mt-16 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <div className="border border-[var(--dc-border)] bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">Verified voices</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.04em] text-[var(--dc-heading)]">Customer reviews</h2>
        <div className="mt-6 space-y-5">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="border border-[var(--dc-border)] bg-[var(--dc-surface)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[var(--dc-heading)]">{review.title || "Product review"}</h3>
                    <p className="mt-1 text-sm text-[var(--dc-muted)]">{review.userName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-3.5 w-3.5 ${star <= review.rating ? "fill-[var(--accent)]" : "fill-none"}`} style={{ color: "var(--accent)" }} />
                      ))}
                    </div>
                    <span className="text-xs font-black text-white/80">{review.rating}/5</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" style={{ color: "var(--accent)" }} />
                  <span className="text-xs" style={{ color: "var(--accent)" }}>Verified Purchase</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--dc-muted)]">{review.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--dc-muted)]">No reviews yet. Be the first to review this product.</p>
          )}
        </div>
      </div>
      <form className="border border-[var(--dc-border)] bg-white p-6 shadow-sm md:p-8" onSubmit={handleSubmit}>
        <h2 className="text-3xl font-black uppercase tracking-[0.04em] text-[var(--dc-heading)]">Write a review</h2>
        <div className="mt-6 grid gap-4">
          <Input placeholder="Review title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="p-1 transition hover:scale-110">
                <Star className={`h-6 w-6 ${star <= (hoverRating || rating) ? "fill-[var(--accent)]" : "fill-none"}`} style={{ color: "var(--accent)" }} />
              </button>
            ))}
            <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>{rating}/5</span>
          </div>
          <Textarea placeholder="Share your experience (min 10 characters)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={4} />
          <p className="text-xs" style={{ color: "var(--text-muted)", textAlign: "right" }}>{comment.length}/2000</p>
        </div>
        <Button type="submit" className="mt-6" disabled={loading || comment.trim().length < 10}>
          {loading ? "Submitting..." : "Submit review"}
        </Button>
      </form>
    </section>
  );
}
