"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SupportTicketsPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ ticketNumber: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim() || subject.trim(),
          category,
          orderNumber: orderNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreated({ ticketNumber: data.ticketNumber });
        toast.success("Support ticket created!");
      } else {
        toast.error(data.message || "Failed to create ticket.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mb-4 text-5xl">🎫</div>
        <h1 className="mb-2 text-2xl font-bold">Ticket Created</h1>
        <p className="mb-1 text-gray-600">
          Your ticket <span className="font-semibold">{created.ticketNumber}</span> has been submitted.
        </p>
        <p className="mb-6 text-sm text-gray-500">Our team will get back to you shortly.</p>
        <button
          onClick={() => router.push("/my-orders")}
          className="rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          My Orders
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Contact Support</h1>
      <p className="mb-8 text-sm text-gray-500">We typically respond within 24 hours.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          >
            <option value="general">General Inquiry</option>
            <option value="order">Order Issue</option>
            <option value="payment">Payment Issue</option>
            <option value="shipping">Shipping Issue</option>
            <option value="return">Return / Exchange</option>
            <option value="cancellation">Cancellation</option>
            <option value="product">Product Question</option>
            <option value="complaint">Complaint</option>
            <option value="account">Account Issue</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Order Number (optional)</label>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. VRX-1001"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your issue"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Tell us more about your issue..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !subject.trim()}
          className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Ticket"}
        </button>
      </form>
    </div>
  );
}
