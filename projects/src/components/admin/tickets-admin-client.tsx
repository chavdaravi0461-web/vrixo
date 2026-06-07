"use client";

import { useState } from "react";
import type { SupportTicket } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  open: "os-badge-warning",
  in_progress: "os-badge-info",
  waiting_on_customer: "os-badge-gray",
  waiting_on_admin: "os-badge-warning",
  resolved: "os-badge-success",
  closed: "os-badge-gray",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "os-badge-gray",
  normal: "os-badge-info",
  high: "os-badge-warning",
  urgent: "os-badge-danger",
};

export function TicketsAdminClient({ initialTickets }: { initialTickets: SupportTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  async function handleStatusChange(ticketId: string, newStatus: string) {
    const res = await fetch(`/api/admin/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus as SupportTicket["status"] } : t)));
    }
  }

  async function handleReply(ticketId: string) {
    if (!reply.trim()) return;
    const res = await fetch(`/api/admin/tickets/${ticketId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply.trim(), internalNote: internal }),
    });
    if (res.ok) {
      setReply("");
      setInternal(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="os-card p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--os-text-3)]">{openCount} open</span>
            {["all", "open", "in_progress", "waiting_on_customer", "waiting_on_admin", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`os-btn-xs ${filter === s ? "os-btn-primary" : "os-btn-ghost"}`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--os-text-3)]">No tickets found.</p>
            )}
            {filtered.map((ticket) => (
              <div
                key={ticket.id}
                className={`cursor-pointer rounded-lg border p-4 transition-colors hover:border-[var(--os-border-hover)] ${selected?.id === ticket.id ? "border-[var(--os-accent)]" : "border-[var(--os-border)]"}`}
                onClick={() => setSelected(ticket)}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--os-text)]">{ticket.ticketNumber}</span>
                  <div className="flex gap-1.5">
                    <span className={`os-badge ${PRIORITY_COLORS[ticket.priority] ?? "os-badge-gray"} text-[10px]`}>
                      {ticket.priority}
                    </span>
                    <span className={`os-badge ${STATUS_COLORS[ticket.status] ?? "os-badge-gray"} text-[10px]`}>
                      {ticket.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <p className="mb-0.5 text-sm text-[var(--os-text)]">{ticket.subject}</p>
                <p className="text-xs text-[var(--os-text-3)]">
                  {ticket.customerName} &middot; {ticket.customerPhone}
                  {ticket.orderNumber && ` &middot; Order #${ticket.orderNumber}`}
                </p>
                <p className="mt-1 text-xs text-[var(--os-text-3)]">{new Date(ticket.createdAt).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        {selected ? (
          <div className="os-card p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--os-text)]">{selected.ticketNumber}</h3>
              <p className="text-xs text-[var(--os-text-3)]">{selected.subject}</p>
            </div>

            <div className="mb-3">
              <p className="text-xs text-[var(--os-text-2)]">{selected.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                  className="rounded border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1 text-[11px] text-[var(--os-text)]"
                >
                  {["open", "in_progress", "waiting_on_customer", "waiting_on_admin", "resolved", "closed"].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-3 space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                rows={4}
                className="w-full rounded border border-[var(--os-border)] bg-[var(--os-bg)] p-2 text-xs text-[var(--os-text)]"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--os-text-3)]">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Internal note
                </label>
                <button onClick={() => handleReply(selected.id)} className="os-btn-primary ml-auto text-xs">
                  Send
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--os-border)] pt-3 text-xs text-[var(--os-text-3)]">
              <p>Customer: {selected.customerName} ({selected.customerPhone})</p>
              {selected.orderNumber && <p>Order: #{selected.orderNumber}</p>}
              <p>Source: {selected.source}</p>
              <p>Created: {new Date(selected.createdAt).toLocaleString("en-IN")}</p>
            </div>
          </div>
        ) : (
          <div className="os-card p-4">
            <p className="text-center text-sm text-[var(--os-text-3)]">Select a ticket to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
