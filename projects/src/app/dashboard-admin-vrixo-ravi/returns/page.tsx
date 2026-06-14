"use client";

import { useState, useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

type ReturnItem = {
  id: string;
  order_number?: string;
  customer_name: string;
  customer_phone: string;
  reason: string;
  status: string;
  refund_amount: number | null;
  created_at: string;
};

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturns();
  }, []);

  async function fetchReturns() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/returns");
      const json = await res.json();
      setReturns(json.returns ?? []);
    } catch {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(returnId: string, action: string) {
    const res = await fetch(`/api/admin/returns/${returnId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) fetchReturns();
  }

  return (
    <AdminShell>
      <section className="os-hero mb-6 p-5 md:p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="os-dot live" />
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--os-text-3)]">Returns</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl tracking-tight">Return Requests</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--os-text-3)]">Manage customer return and refund requests.</p>
        </div>
      </section>

      <div className="os-card p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--os-text-3)]">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-[var(--os-text-3)]">No return requests.</td></tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm text-[var(--os-text)]">{r.order_number ?? "—"}</td>
                      <td className="text-sm text-[var(--os-text-2)]">{r.customer_name}</td>
                      <td className="max-w-[200px] truncate text-sm text-[var(--os-text-2)]">{r.reason}</td>
                      <td>
                        <span className={`os-badge ${r.status === "pending" ? "os-badge-warning" : r.status === "approved" ? "os-badge-info" : r.status === "rejected" ? "os-badge-danger" : "os-badge-success"} text-[10px]`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--os-text-2)]">₹{r.refund_amount ?? 0}</td>
                      <td className="text-sm text-[var(--os-text-3)]">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                      <td>
                        {r.status === "pending" && (
                          <div className="flex gap-1">
                            <button onClick={() => handleAction(r.id, "approve")} className="os-btn-primary text-[10px]">Approve</button>
                            <button onClick={() => handleAction(r.id, "reject")} className="os-btn-danger text-[10px]">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
