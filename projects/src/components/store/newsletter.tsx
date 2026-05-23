"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message);
      }
      toast.success("Newsletter subscribed successfully.");
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container mt-16">
      <div className="overflow-hidden border border-[#c5aa86] bg-[#181510] px-6 py-10 text-white md:px-12">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f3d7a0]">
              Insider access
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-black uppercase leading-tight tracking-[0.04em] md:text-4xl">
              Early offers, weekly drops, and premium styling edits.
            </h2>
            <p className="mt-4 max-w-xl text-slate-300">
              Join the Vrixo newsletter for curated launches, exclusive discounts, and stock
              alerts on the most-loved shoes and watches.
            </p>
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded-none border-white/10 bg-white text-slate-900"
            />
            <Button type="submit" variant="secondary" disabled={loading} className="rounded-none font-black uppercase tracking-[0.12em]">
              {loading ? "Joining..." : "Join now"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
