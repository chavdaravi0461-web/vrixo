"use client";

import { useState, useEffect } from "react";

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
};

export function CustomersAdminClient() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/customers?${params}`);
      const json = await res.json();
      setCustomers(json.customers ?? []);
      setTotal(json.pagination?.total ?? 0);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="os-card p-4">
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, or phone..."
            className="flex-1 rounded border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2 text-sm text-[var(--os-text)]"
          />
          <span className="text-xs text-[var(--os-text-3)]">{total} customers</span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--os-text-3)]">Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="os-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Orders</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm font-medium text-[var(--os-text)]">{c.name}</td>
                      <td className="text-sm text-[var(--os-text-2)]">{c.email ?? "—"}</td>
                      <td className="text-sm text-[var(--os-text-2)]">{c.phone ?? "—"}</td>
                      <td className="text-sm text-[var(--os-text-2)]">{c.orderCount}</td>
                      <td>
                        <span className={`os-badge ${c.role === "admin" ? "os-badge-info" : "os-badge-gray"} text-[10px]`}>
                          {c.role}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--os-text-3)]">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="os-btn-ghost os-btn-xs disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-xs text-[var(--os-text-3)]">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="os-btn-ghost os-btn-xs disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
