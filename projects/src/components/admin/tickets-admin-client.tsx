"use client";

import { useState, useMemo } from "react";
import type { SupportTicket, TicketReply } from "@/types";
import {
  Mail, Clock, CheckCircle2, AlertTriangle, User, Phone,
  Package, Search, Filter, X, Send, ChevronDown, ExternalLink,
  MessageSquare, Tag, Calendar, ArrowUpRight, Loader2
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "var(--cos-amber)", bg: "var(--cos-amber-dim)", icon: Clock },
  in_progress: { label: "In Progress", color: "var(--cos-accent)", bg: "var(--cos-accent-dim)", icon: ArrowUpRight },
  waiting_on_customer: { label: "Waiting on Customer", color: "var(--cos-sky)", bg: "var(--cos-sky-dim)", icon: User },
  waiting_on_admin: { label: "Waiting on Us", color: "var(--cos-violet)", bg: "var(--cos-violet-dim)", icon: Clock },
  resolved: { label: "Resolved", color: "var(--cos-emerald)", bg: "var(--cos-emerald-dim)", icon: CheckCircle2 },
  closed: { label: "Closed", color: "var(--cos-text-tertiary)", bg: "rgba(255,255,255,0.03)", icon: X },
};

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--cos-text-tertiary)", bg: "rgba(255,255,255,0.03)" },
  normal: { label: "Normal", color: "var(--cos-accent)", bg: "var(--cos-accent-dim)" },
  high: { label: "High", color: "var(--cos-amber)", bg: "var(--cos-amber-dim)" },
  urgent: { label: "Urgent", color: "var(--cos-rose)", bg: "var(--cos-rose-dim)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General", order: "Order", payment: "Payment", shipping: "Shipping",
  product: "Product", return: "Return", cancellation: "Cancel", account: "Account",
  complaint: "Complaint", other: "Other",
};

const STATUS_FILTERS = ["all", "open", "in_progress", "waiting_on_customer", "waiting_on_admin", "resolved", "closed"];

export function TicketsAdminClient({ initialTickets }: { initialTickets: SupportTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const filtered = useMemo(() => {
    let list = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerPhone.includes(q)
      );
    }
    return list;
  }, [tickets, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length };
    for (const t of tickets) {
      c[t.status] = (c[t.status] || 0) + 1;
    }
    return c;
  }, [tickets]);

  async function handleStatusChange(ticketId: string, newStatus: string) {
    const res = await fetch(`/api/admin/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus as SupportTicket["status"] } : t)));
      if (selected?.id === ticketId) setSelected((prev) => prev ? { ...prev, status: newStatus as SupportTicket["status"] } : prev);
    }
  }

  async function handleReply(ticketId: string) {
    if (!reply.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim(), internalNote: internal }),
      });
      if (res.ok) {
        setReply("");
        setInternal(false);
      }
    } finally {
      setSendingReply(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div>
      {/* ─── Stats Strip ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Total", value: tickets.length, color: "var(--cos-text-primary)" },
          { label: "Open", value: counts.open || 0, color: "var(--cos-amber)" },
          { label: "In Progress", value: counts.in_progress || 0, color: "var(--cos-accent)" },
          { label: "Waiting", value: (counts.waiting_on_customer || 0) + (counts.waiting_on_admin || 0), color: "var(--cos-sky)" },
          { label: "Resolved", value: counts.resolved || 0, color: "var(--cos-emerald)" },
          { label: "Closed", value: counts.closed || 0, color: "var(--cos-text-tertiary)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="cos-metric-card" style={{ padding: "14px 16px" }}>
            <div className="cos-metric-label">{label}</div>
            <div className="cos-metric-value" style={{ fontSize: "20px", color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ─── Toolbar ─── */}
      <div className="cos-section" style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", flexWrap: "wrap" }}>
          {/* Search */}
          <div className="cos-search" style={{ flex: 1, minWidth: "200px", maxWidth: "360px" }}>
            <Search size={14} style={{ color: "var(--cos-text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: "transparent", border: "0", outline: "0", color: "var(--cos-text-primary)", fontSize: "13px", width: "100%" }}
            />
          </div>

          {/* Status Filters */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="cos-chip"
                style={{
                  fontSize: "11px",
                  padding: "5px 12px",
                  ...(filter === s ? {
                    background: "var(--cos-accent)",
                    color: "#fff",
                    borderColor: "var(--cos-accent)",
                  } : {}),
                }}
              >
                {s === "all" ? "All" : STATUS_MAP[s]?.label || s.replace(/_/g, " ")}
                <span style={{
                  marginLeft: "4px",
                  padding: "0 5px",
                  borderRadius: "99px",
                  background: filter === s ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
                  fontSize: "10px",
                  fontWeight: 700,
                }}>
                  {counts[s] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main Layout: Table + Detail Panel ─── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: "16px", alignItems: "start" }}>

        {/* ─── Table ─── */}
        <div className="cos-section">
          <div className="cos-section-body-compact">
            {/* Table Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 130px 100px 120px 100px",
              gap: "12px",
              padding: "10px 16px",
              borderBottom: "1px solid var(--cos-border)",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--cos-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              <span>Ticket</span>
              <span>Subject / Customer</span>
              <span>Category</span>
              <span>Priority</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Date</span>
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 16px", textAlign: "center" }}>
                <Mail size={28} style={{ color: "var(--cos-text-tertiary)", opacity: 0.4, margin: "0 auto 12px" }} />
                <p style={{ fontSize: "13px", color: "var(--cos-text-tertiary)" }}>No tickets found.</p>
              </div>
            ) : (
              filtered.map((ticket) => {
                const st = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                const pr = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
                const isActive = selected?.id === ticket.id;

                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelected(isActive ? null : ticket)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 130px 100px 120px 100px",
                      gap: "12px",
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--cos-border-subtle)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      background: isActive ? "var(--cos-accent-dim)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--cos-accent)" : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Ticket Number */}
                    <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--cos-mono)", color: "var(--cos-accent)" }}>
                      {ticket.ticketNumber}
                    </span>

                    {/* Subject + Customer */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--cos-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ticket.subject}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={10} />
                        {ticket.customerName}
                        <span style={{ opacity: 0.4 }}>·</span>
                        {ticket.customerPhone}
                        {ticket.orderNumber && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ fontFamily: "var(--cos-mono)" }}>#{ticket.orderNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <span style={{ fontSize: "11px", color: "var(--cos-text-secondary)" }}>
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>

                    {/* Priority */}
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      borderRadius: "99px",
                      background: pr.bg,
                      color: pr.color,
                      fontSize: "10px",
                      fontWeight: 700,
                      width: "fit-content",
                      textTransform: "capitalize",
                    }}>
                      {ticket.priority}
                    </span>

                    {/* Status */}
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 8px",
                      borderRadius: "99px",
                      background: st.bg,
                      color: st.color,
                      fontSize: "10px",
                      fontWeight: 700,
                      width: "fit-content",
                    }}>
                      <st.icon size={10} />
                      {st.label}
                    </span>

                    {/* Date */}
                    <span style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", textAlign: "right", fontFamily: "var(--cos-mono)" }}>
                      {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Detail Panel ─── */}
        {selected && (
          <div className="cos-section" style={{ position: "sticky", top: "80px" }}>
            {/* Panel Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--cos-border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--cos-mono)", color: "var(--cos-accent)" }}>
                    {selected.ticketNumber}
                  </span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "99px",
                    background: (STATUS_MAP[selected.status] || STATUS_MAP.open).bg,
                    color: (STATUS_MAP[selected.status] || STATUS_MAP.open).color,
                    fontSize: "10px",
                    fontWeight: 700,
                  }}>
                    {(STATUS_MAP[selected.status] || STATUS_MAP.open).label}
                  </span>
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cos-text-primary)", lineHeight: 1.3 }}>
                  {selected.subject}
                </h3>
              </div>
              <button onClick={() => setSelected(null)} className="cos-ghost" style={{ width: "28px", height: "28px", flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ padding: "16px 20px", maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>

              {/* Customer Info */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "8px" }}>
                  Customer
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cos-text-secondary)" }}>
                    <User size={12} style={{ color: "var(--cos-text-tertiary)" }} />
                    {selected.customerName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cos-text-secondary)" }}>
                    <Phone size={12} style={{ color: "var(--cos-text-tertiary)" }} />
                    {selected.customerPhone}
                  </div>
                  {selected.orderNumber && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cos-text-secondary)" }}>
                      <Package size={12} style={{ color: "var(--cos-text-tertiary)" }} />
                      Order #{selected.orderNumber}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cos-text-secondary)" }}>
                    <Calendar size={12} style={{ color: "var(--cos-text-tertiary)" }} />
                    {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "8px" }}>
                  Description
                </div>
                <p style={{ fontSize: "13px", color: "var(--cos-text-secondary)", lineHeight: 1.7, background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "var(--cos-r)" }}>
                  {selected.description}
                </p>
              </div>

              {/* Status Change */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "8px" }}>
                  Update Status
                </div>
                <select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                  className="cos-select"
                  style={{ fontSize: "12px", padding: "8px 12px" }}
                >
                  {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Reply */}
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "8px" }}>
                  Reply
                </div>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  rows={4}
                  className="cos-input"
                  style={{ resize: "vertical", marginBottom: "8px", fontSize: "12px" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--cos-text-tertiary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                      style={{ accentColor: "var(--cos-accent)" }}
                    />
                    Internal note
                  </label>
                  <button
                    onClick={() => handleReply(selected.id)}
                    disabled={!reply.trim() || sendingReply}
                    className="cos-btn cos-btn-primary"
                    style={{ fontSize: "11px", padding: "6px 14px", opacity: !reply.trim() || sendingReply ? 0.5 : 1 }}
                  >
                    {sendingReply ? <Loader2 size={12} className="cos-spin" /> : <Send size={12} />}
                    {sendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
