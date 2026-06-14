"use client";

import { useState } from "react";
import { toast } from "sonner";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

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
      toast.success("Subscribed successfully!");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="newsletter">
      <div className="container">
        <div className="newsletter-card anim-fade-up">
          <span className="section-eyebrow">Stay connected</span>
          <h2 className="display-md" style={{ marginBottom: "8px" }}>Join the inner circle</h2>
          <p className="body">
            Be the first to know about new arrivals, exclusive drops, and curated edits.
          </p>
          <form onSubmit={handleSubmit} className="newsletter-form">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Sending\u2026" : "Subscribe"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
