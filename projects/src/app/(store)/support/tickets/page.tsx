"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  orderNumber: string | null;
};

type Tab = "create" | "view";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  in_progress: { label: "In Progress", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  waiting_on_customer: { label: "Waiting on You", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  waiting_on_admin: { label: "Waiting on Us", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  resolved: { label: "Resolved", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  closed: { label: "Closed", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  order: "Order Issue",
  payment: "Payment",
  shipping: "Shipping",
  product: "Product",
  return: "Return / Exchange",
  cancellation: "Cancellation",
  account: "Account",
  complaint: "Complaint",
};

export default function SupportTicketsPage() {
  const [tab, setTab] = useState<Tab>("create");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      if (res.ok) setTickets(data.tickets || []);
    } catch {
      /* silent */
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

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
        toast.success(`Ticket ${data.ticketNumber} created!`);
        setSubject("");
        setDescription("");
        setOrderNumber("");
        setCategory("general");
        setTab("view");
        fetchTickets();
      } else {
        toast.error(data.message || "Failed to create ticket.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--accent)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Support Center
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
            We typically respond within 24 hours.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "var(--glass)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          <button
            onClick={() => setTab("create")}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              background: tab === "create" ? "rgba(255,255,255,0.1)" : "transparent",
              color: tab === "create" ? "#fff" : "rgba(255,255,255,0.45)",
            }}
          >
            Create Ticket
          </button>
          <button
            onClick={() => { setTab("view"); fetchTickets(); }}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              background: tab === "view" ? "rgba(255,255,255,0.1)" : "transparent",
              color: tab === "view" ? "#fff" : "rgba(255,255,255,0.45)",
              position: "relative",
            }}
          >
            My Tickets
            {tickets.length > 0 && (
              <span style={{
                marginLeft: 8,
                background: "var(--accent)",
                color: "var(--bg)",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 700,
              }}>
                {tickets.length}
              </span>
            )}
          </button>
        </div>

        {/* CREATE TAB */}
        {tab === "create" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
            {/* Category */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 16px center",
                }}
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Order Number */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Order Number <span style={{ opacity: 0.5 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. VRX-1001"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Tell us more about your issue..."
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical" as const,
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !subject.trim()}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                background: subject.trim() ? "#fff" : "rgba(255,255,255,0.1)",
                color: subject.trim() ? "#000" : "rgba(255,255,255,0.3)",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !subject.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.01em",
              }}
            >
              {loading ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        )}

        {/* VIEW TAB */}
        {tab === "view" && (
          <div>
            {ticketsLoading ? (
              <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                Loading tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div style={{
                padding: 48,
                textAlign: "center",
                background: "var(--bg-card)",
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No tickets yet</h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                  Create your first support ticket and we&apos;ll help you out.
                </p>
                <button
                  onClick={() => setTab("create")}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Create Ticket
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Table Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 120px 120px 100px",
                  gap: 12,
                  padding: "10px 16px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  <span>Ticket</span>
                  <span>Subject</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span style={{ textAlign: "right" }}>Date</span>
                </div>

                {/* Ticket Rows */}
                {tickets.map((ticket) => {
                  const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const isExpanded = expandedTicket === ticket.id;

                  return (
                    <div key={ticket.id}>
                      {/* Row */}
                      <div
                        onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "100px 1fr 120px 120px 100px",
                          gap: 12,
                          padding: "14px 16px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                          cursor: "pointer",
                          transition: "background 0.15s",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                      >
                        {/* Ticket Number */}
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>
                          {ticket.ticketNumber}
                        </span>

                        {/* Subject */}
                        <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ticket.subject}
                        </span>

                        {/* Category */}
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </span>

                        {/* Status Badge */}
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: st.bg,
                          color: st.color,
                          fontSize: 12,
                          fontWeight: 600,
                          width: "fit-content",
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: st.color,
                            flexShrink: 0,
                          }} />
                          {st.label}
                        </span>

                        {/* Date */}
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div style={{
                          padding: "16px 20px",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid var(--border)",
                          borderTop: "none",
                          borderRadius: "0 0 10px 10px",
                          marginBottom: 2,
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Description
                              </div>
                              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>
                                {ticket.description}
                              </p>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {ticket.orderNumber && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                    Order
                                  </div>
                                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "rgba(255,255,255,0.65)" }}>
                                    {ticket.orderNumber}
                                  </span>
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                  Last Updated
                                </div>
                                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                                  {formatDate(ticket.updatedAt)}
                                </span>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                  Priority
                                </div>
                                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textTransform: "capitalize" }}>
                                  {ticket.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
