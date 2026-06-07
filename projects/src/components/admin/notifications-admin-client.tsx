"use client";

import { useState, useEffect } from "react";

type NotificationEntry = {
  id?: string;
  order_id?: string;
  orderId?: string;
  status: string;
  attempts?: number;
  max_attempts?: number;
  last_error?: string;
  error?: string;
  created_at?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
};

export function NotificationsAdminClient() {
  const [activeTab, setActiveTab] = useState<"pending" | "failed" | "recent">("pending");
  const [data, setData] = useState<{
    pending: NotificationEntry[];
    failed: NotificationEntry[];
    recent: NotificationEntry[];
  }>({ pending: [], failed: [], recent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications?limit=100");
      const json = await res.json();
      setData({
        pending: json.db?.pending ?? [],
        failed: json.db?.failed ?? [],
        recent: json.redis?.recent ?? [],
      });
    } catch {
      setData({ pending: [], failed: [], recent: [] });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(notificationId: string) {
    const res = await fetch(`/api/admin/notifications/${notificationId}/resend`, {
      method: "POST",
    });
    if (res.ok) {
      fetchData();
    }
  }

  const currentItems = activeTab === "pending" ? data.pending : activeTab === "failed" ? data.failed : data.recent;

  return (
    <div className="os-card p-4">
      <div className="mb-4 flex items-center gap-3">
        {(["pending", "failed", "recent"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`os-btn-xs ${activeTab === tab ? "os-btn-primary" : "os-btn-ghost"}`}
          >
            {tab} ({data[tab].length})
          </button>
        ))}
        <button onClick={fetchData} className="os-btn-ghost os-btn-xs ml-auto">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--os-text-3)]">Loading...</p>
      ) : currentItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--os-text-3)]">No {activeTab} notifications.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="os-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, idx) => (
                <tr key={item.id ?? item.orderId ?? idx}>
                  <td className="text-xs text-[var(--os-text-2)]">
                    {item.order_id ? item.order_id.slice(0, 8) : item.orderId?.slice(0, 8) ?? "—"}
                  </td>
                  <td>
                    <span className={`os-badge ${item.status === "failed" ? "os-badge-danger" : item.status === "pending" ? "os-badge-warning" : "os-badge-success"} text-[10px]`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="text-xs text-[var(--os-text-2)]">
                    {item.attempts ?? 0}/{item.max_attempts ?? 8}
                  </td>
                  <td className="max-w-[200px] truncate text-xs text-[var(--os-text-3)]">
                    {item.last_error ?? item.error ?? "—"}
                  </td>
                  <td className="text-xs text-[var(--os-text-3)]">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN") : item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td>
                    {item.id ? (
                      <button onClick={() => { const nid = item.id; if (nid) handleResend(nid); }} className="os-btn-primary text-[10px]">
                        Resend
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
