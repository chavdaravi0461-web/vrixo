"use client";

import { useState } from "react";
import { toast } from "sonner";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubscribed(true);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  }

  if (subscribed) {
    return (
      <section className="newsletter" aria-label="Newsletter subscription">
        <div className="container">
          <div className="newsletter-card anim-fade-up">
            <span className="section-eyebrow">Stay connected</span>
            <h2 className="display-md" style={{ marginBottom: "8px" }}>You&apos;re all set</h2>
            <p className="body">
              You&apos;re now part of our inner circle. Expect exclusive drops, new arrivals, and curated edits.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="newsletter" aria-label="Newsletter subscription">
      <div className="container">
        <div className="newsletter-card anim-fade-up">
          <span className="section-eyebrow">Stay connected</span>
          <h2 className="display-md" style={{ marginBottom: "8px" }}>Join the inner circle</h2>
          <p className="body">
            Be the first to know about new arrivals, exclusive drops, and curated edits. Already have an account? You&apos;re automatically subscribed.
          </p>
          <form onSubmit={handleSubmit} className="newsletter-form" aria-label="Newsletter form">
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-required="true"
            />
            <button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? "Sending\u2026" : "Subscribe"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
