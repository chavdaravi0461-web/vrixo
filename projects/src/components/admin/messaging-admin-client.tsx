"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Users, Mail, CheckCircle2, XCircle, Search, ChevronDown, History } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

type MessageRecord = {
  id: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_by: string;
  created_at: string;
};

export function MessagingAdminClient() {
  const [tab, setTab] = useState<"compose" | "history">("compose");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientMode, setRecipientMode] = useState<"all" | "newsletter" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [history, setHistory] = useState<MessageRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerSearch) params.set("search", customerSearch);
      const res = await fetch(`/api/admin/messaging/customers?${params}`);
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } catch {
      setCustomers([]);
    }
  }, [customerSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(historyPage), limit: "15" });
      const res = await fetch(`/api/admin/messaging?${params}`);
      const json = await res.json();
      setHistory(json.messages ?? []);
      setHistoryTotal(json.pagination?.total ?? 0);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(customers.map((c) => c.id)));
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    if (recipientMode === "selected" && selectedIds.size === 0) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipientMode,
          selectedIds: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      setSendResult({ ok: res.ok, message: json.message });
      if (res.ok) {
        setSubject("");
        setBody("");
        setSelectedIds(new Set());
      }
    } catch {
      setSendResult({ ok: false, message: "Failed to send. Please try again." });
    } finally {
      setSending(false);
    }
  }

  const filteredCustomers = customerSearch
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  const historyTotalPages = Math.ceil(historyTotal / 15);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("compose")}
          className={`os-btn-ghost text-sm ${tab === "compose" ? "text-[var(--cos-accent)]" : "text-[var(--os-text-3)]"}`}
        >
          <Send className="mr-1 inline h-3.5 w-3.5" /> Compose
        </button>
        <button
          onClick={() => setTab("history")}
          className={`os-btn-ghost text-sm ${tab === "history" ? "text-[var(--cos-accent)]" : "text-[var(--os-text-3)]"}`}
        >
          <History className="mr-1 inline h-3.5 w-3.5" /> History
        </button>
      </div>

      {tab === "compose" && (
        <div className="os-card p-5 space-y-5">
          <div>
            <label className="os-label">Recipients</label>
            <div className="flex gap-2 mt-1.5">
              {([
                { value: "all", label: "All Customers", icon: Users },
                { value: "newsletter", label: "Newsletter Subscribers", icon: Mail },
                { value: "selected", label: "Select Specific", icon: Search },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setRecipientMode(value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    recipientMode === value
                      ? "border-[var(--cos-accent)] bg-[var(--cos-accent)]/10 text-[var(--cos-accent)]"
                      : "border-[var(--os-border)] bg-[var(--os-bg)] text-[var(--os-text-3)] hover:border-[var(--os-text-3)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {recipientMode === "selected" && (
            <div className="relative">
              <label className="os-label">Select Customers</label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--os-text-3)]" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Search customers..."
                    className="os-input pl-9 text-sm"
                  />
                </div>
                <button onClick={selectAllFiltered} className="os-btn-ghost text-xs whitespace-nowrap">
                  Select All
                </button>
              </div>

              {selectedIds.size > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customers
                    .filter((c) => selectedIds.has(c.id))
                    .slice(0, 20)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--cos-accent)]/10 border border-[var(--cos-accent)]/20 px-2.5 py-0.5 text-xs text-[var(--cos-accent)]"
                      >
                        {c.name || c.email}
                        <button onClick={() => toggleCustomer(c.id)} className="ml-0.5 hover:opacity-70">
                          <XCircle className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  {selectedIds.size > 20 && (
                    <span className="text-xs text-[var(--os-text-3)]">+{selectedIds.size - 20} more</span>
                  )}
                </div>
              )}

              {customerDropdownOpen && filteredCustomers.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[var(--os-border)] bg-[var(--os-bg)] shadow-xl">
                  {filteredCustomers.slice(0, 50).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        toggleCustomer(c.id);
                        setCustomerSearch("");
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                        selectedIds.has(c.id) ? "bg-[var(--cos-accent)]/5" : ""
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          selectedIds.has(c.id)
                            ? "border-[var(--cos-accent)] bg-[var(--cos-accent)]"
                            : "border-[var(--os-border)]"
                        }`}
                      >
                        {selectedIds.has(c.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--os-text)]">{c.name || "Unnamed"}</div>
                        <div className="truncate text-xs text-[var(--os-text-3)]">{c.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-1 text-xs text-[var(--os-text-3)]">{selectedIds.size} customer(s) selected</p>
            </div>
          )}

          <div>
            <label htmlFor="msg-subject" className="os-label">Subject</label>
            <input
              id="msg-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New Collection Just Dropped"
              className="os-input mt-1.5 text-sm"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="msg-body" className="os-label">Message</label>
            <textarea
              id="msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here... Use plain text, it will be formatted nicely in the email."
              rows={8}
              className="os-input mt-1.5 text-sm resize-y"
              maxLength={5000}
            />
            <p className="mt-1 text-xs text-[var(--os-text-3)]">{body.length}/5000 characters</p>
          </div>

          {sendResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                sendResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-400"
              }`}
            >
              {sendResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || (recipientMode === "selected" && selectedIds.size === 0)}
              className="os-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="mr-1.5 inline h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send Message"}
            </button>
            {recipientMode === "all" && (
              <span className="text-xs text-[var(--os-text-3)]">Will send to all customers with an email</span>
            )}
            {recipientMode === "newsletter" && (
              <span className="text-xs text-[var(--os-text-3)]">Will send to all newsletter subscribers</span>
            )}
            {recipientMode === "selected" && (
              <span className="text-xs text-[var(--os-text-3)]">Will send to {selectedIds.size} selected customer(s)</span>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="os-card">
          {historyLoading ? (
            <p className="py-12 text-center text-sm text-[var(--os-text-3)]">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--os-text-3)]">No messages sent yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="os-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Recipients</th>
                      <th>Sent</th>
                      <th>Failed</th>
                      <th>Sent By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((m) => (
                      <tr key={m.id}>
                        <td className="text-sm font-medium text-[var(--os-text)]">{m.subject}</td>
                        <td className="text-sm text-[var(--os-text-2)]">{m.recipient_count}</td>
                        <td>
                          <span className="os-badge os-badge-success text-[10px]">{m.sent_count}</span>
                        </td>
                        <td>
                          {m.failed_count > 0 ? (
                            <span className="os-badge os-badge-danger text-[10px]">{m.failed_count}</span>
                          ) : (
                            <span className="text-xs text-[var(--os-text-3)]">0</span>
                          )}
                        </td>
                        <td className="text-sm text-[var(--os-text-3)]">{m.sent_by}</td>
                        <td className="text-sm text-[var(--os-text-3)]">
                          {new Date(m.created_at).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <button
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="os-btn-ghost os-btn-xs disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-[var(--os-text-3)]">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <button
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="os-btn-ghost os-btn-xs disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
