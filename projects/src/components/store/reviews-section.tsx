"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Review } from "@/types/index";

export function ReviewsSection({
  productId,
  reviews
}: {
  productId: string;
  reviews: Review[];
}) {
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("5");
  const [loading, setLoading] = useState(false);

  return (
    <section className="container mt-16 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <div className="border border-[var(--dc-border)] bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--dc-gold)]">Verified voices</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.04em] text-[var(--dc-black)]">Customer reviews</h2>
        <div className="mt-6 space-y-5">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="border border-[var(--dc-border)] bg-[var(--dc-cream)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[var(--dc-black)]">{review.title || "Verified review"}</h3>
                    <p className="mt-1 text-sm text-[var(--dc-muted)]">{review.userName}</p>
                  </div>
                  <p className="text-sm font-black text-[var(--dc-gold-dark)]">{review.rating}/5</p>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--dc-muted)]">{review.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--dc-muted)]">No reviews yet. Be the first to review this product.</p>
          )}
        </div>
      </div>
      <form
        className="border border-[var(--dc-border)] bg-white p-6 shadow-sm md:p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          const response = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              title,
              comment,
              rating: Number(rating)
            })
          });
          const payload = await response.json();
          setLoading(false);
          if (!response.ok) {
            toast.error(payload.message ?? "Failed to submit review.");
            return;
          }
          toast.success("Review submitted for approval.");
          location.reload();
        }}
      >
        <h2 className="text-3xl font-black uppercase tracking-[0.04em] text-[var(--dc-black)]">Write a review</h2>
        <div className="mt-6 grid gap-4">
          <Input placeholder="Review title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input
            placeholder="Rating from 1 to 5"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          />
          <Textarea placeholder="Share your experience" value={comment} onChange={(event) => setComment(event.target.value)} />
        </div>
        <Button type="submit" className="mt-6" disabled={loading}>
          {loading ? "Submitting..." : "Submit review"}
        </Button>
      </form>
    </section>
  );
}
