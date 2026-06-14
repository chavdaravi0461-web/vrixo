"use client";

import type { ComponentType } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, Search, UserRound, Truck, Package } from "lucide-react";
import { toast } from "sonner";

const statuses = [
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

type AdminOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  sms_status?: string | null;
  whatsapp_status?: string | null;
  order_status: string;
  total: number;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  created_at?: string;
  shipping_address?: Record<string, unknown> | null;
  items?: Array<{
    productId?: string;
    title?: string;
    image?: string;
    quantity?: number;
    price?: number;
    selectedSize?: string | null;
    selectedColor?: string | null;
    sku?: string | null;
  }>;
};

type OrdersPagination = { page: number; limit: number; total: number };
type OrdersFilters = {
  search: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
};

export function OrdersAdminClient({
  orders,
  pagination,
  filters,
}: {
  orders: AdminOrder[];
  pagination: OrdersPagination;
  filters: OrdersFilters;
}) {
  const router = useRouter();
  const [orderPatches, setOrderPatches] = useState<Record<string, Partial<AdminOrder>>>({});
  const [searchInput, setSearchInput] = useState(filters.search);
  const [orderStatus, setOrderStatus] = useState(filters.orderStatus);
  const [paymentStatus, setPaymentStatus] = useState(filters.paymentStatus);
  const [paymentMethod, setPaymentMethod] = useState(filters.paymentMethod);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [sort, setSort] = useState(filters.sort);

  const updateOrdersUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      const next = {
        page: String(pagination.page),
        limit: String(pagination.limit),
        search: searchInput.trim(),
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        sort,
        date_from: dateFrom,
        date_to: dateTo,
        ...updates,
      };
      Object.entries(next).forEach(([key, value]) => {
        if (value && value !== "all" && !(key === "page" && value === "1") && !(key === "limit" && value === "20")) {
          params.set(key, value);
        }
      });
      const queryString = params.toString();
      router.replace(`/dashboard-admin-vrixo-ravi/orders${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [dateFrom, dateTo, orderStatus, pagination.limit, pagination.page, paymentMethod, paymentStatus, router, searchInput, sort]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateOrdersUrl({ search: searchInput.trim(), page: "1" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, updateOrdersUrl]);

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const currentPage = Math.min(pagination.page, pageCount);
  const visibleOrders = useMemo(
    () => orders.map((order) => ({ ...order, ...orderPatches[order.id] })),
    [orderPatches, orders]
  );

  async function updateOrderStatus(order: AdminOrder, newStatus: string) {
    const previousStatus = order.order_status;
    setOrderPatches((current) => ({ ...current, [order.id]: { order_status: newStatus } }));
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderStatus: newStatus }),
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setOrderPatches((current) => ({ ...current, [order.id]: { order_status: previousStatus } }));
      toast.error(payload?.message ?? "Update failed.");
      return;
    }
    toast.success("Order updated.");
  }

  return (
    <div>
      <section className="cos-section">
        <div className="cos-section-header">
          <div>
            <div className="cos-section-eyebrow">Fulfillment Desk</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Orders</h2>
            <p style={{ fontSize: "12px", color: "var(--cos-text-tertiary)", marginTop: "4px", maxWidth: "480px" }}>
              Search orders, review customer details, verify payment state, and move shipments through the daily workflow.
            </p>
          </div>
          <span className="cos-tag cos-tag-accent">{pagination.total} orders</span>
        </div>
      </section>

      <div className="cos-section" style={{ marginTop: "16px" }}>
        <div className="cos-section-header" style={{ flexWrap: "wrap", gap: "10px" }}>
          <div className="cos-search" style={{ maxWidth: "400px", flex: 1 }}>
            <Search style={{ width: 15, height: 15, color: "var(--cos-text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by order ID, name, phone, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <select className="cos-select" style={{ width: "auto", minWidth: "120px" }} value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); updateOrdersUrl({ order_status: e.target.value, page: "1" }); }}>
              <option value="all">All orders</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="cos-select" style={{ width: "auto", minWidth: "120px" }} value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); updateOrdersUrl({ payment_status: e.target.value, page: "1" }); }}>
              <option value="all">All payments</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="cod_pending">COD pending</option>
            </select>
            <select className="cos-select" style={{ width: "auto", minWidth: "110px" }} value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); updateOrdersUrl({ payment_method: e.target.value, page: "1" }); }}>
              <option value="all">All methods</option>
              <option value="cod">COD</option>
              <option value="online">Online</option>
            </select>
            <input type="date" className="cos-input" style={{ width: "auto" }} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); updateOrdersUrl({ date_from: e.target.value, page: "1" }); }} />
            <input type="date" className="cos-input" style={{ width: "auto" }} value={dateTo} onChange={(e) => { setDateTo(e.target.value); updateOrdersUrl({ date_to: e.target.value, page: "1" }); }} />
            <select className="cos-select" style={{ width: "auto", minWidth: "120px" }} value={sort} onChange={(e) => { setSort(e.target.value); updateOrdersUrl({ sort: e.target.value, page: "1" }); }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="total-desc">Highest total</option>
              <option value="total-asc">Lowest total</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
        {visibleOrders.map((order) => (
          <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="cos-section cos-form-footer" style={{ marginTop: "16px", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "var(--cos-text-tertiary)" }}>
            Showing {visibleOrders.length} of {pagination.total}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="cos-btn cos-btn-ghost" disabled={currentPage <= 1} onClick={() => updateOrdersUrl({ page: String(currentPage - 1) })}>
              Previous
            </button>
            <span style={{ fontSize: "12px", fontFamily: "var(--cos-mono)", color: "var(--cos-text-secondary)" }}>
              Page {currentPage} of {pageCount}
            </span>
            <button type="button" className="cos-btn cos-btn-ghost" disabled={currentPage >= pageCount} onClick={() => updateOrdersUrl({ page: String(currentPage + 1) })}>
              Next
            </button>
          </div>
        </div>
      )}

      {pagination.total === 0 && (
        <div className="cos-section" style={{ marginTop: "16px", padding: "40px", textAlign: "center" }}>
          <Package style={{ width: 32, height: 32, color: "var(--cos-text-tertiary)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "13px", color: "var(--cos-text-secondary)" }}>No matching orders found.</p>
        </div>
      )}
    </div>
  );
}

const OrderCard = memo(function OrderCard({
  order,
  onStatusChange,
}: {
  order: AdminOrder;
  onStatusChange: (order: AdminOrder, orderStatus: string) => Promise<void>;
}) {
  return (
    <div className="cos-section" style={{ overflow: "visible" }}>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 360px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--cos-mono)", color: "var(--cos-text-tertiary)" }}>
                {order.order_number}
              </span>
              <StatusPill value={order.order_status} />
              <PaymentPill value={order.payment_status ?? "pending"} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 700 }}>{order.customer_name}</h2>
              <span className="cos-tag cos-tag-accent">₹{order.total}</span>
            </div>

            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr", marginTop: "12px" }}>
              <CosDetail icon={UserRound} label="Customer" value={order.customer_name || "Not provided"} />
              <CosDetail label="Mobile" value={order.customer_phone || "Not provided"} />
              <CosDetail label="Email" value={order.customer_email || "Not provided"} />
              <CosDetail icon={CalendarClock} label="Order date" value={order.created_at ? new Date(order.created_at).toLocaleString("en-IN") : "N/A"} />
              <CosDetail icon={CreditCard} label="Payment" value={order.payment_method ?? "cod"} />
              <CosDetail label="Payment status" value={order.payment_status ?? "pending"} />
              <CosDetail label="WhatsApp" value={order.whatsapp_status ?? "pending"} />
              <CosDetail label="SMS" value={order.sms_status ?? "pending"} />
              <CosDetail label="Razorpay order" value={order.razorpay_order_id || "N/A"} />
              <CosDetail label="Razorpay payment" value={order.razorpay_payment_id || "N/A"} />
            </div>

            <div style={{ marginTop: "12px", padding: "12px", borderRadius: "var(--cos-r-lg)", border: "1px solid var(--cos-border)", background: "rgba(255,255,255,0.02)" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "6px" }}>
                Shipping address
              </p>
              <p style={{ fontSize: "12px", color: "var(--cos-text-secondary)", lineHeight: 1.6 }}>
                {formatAddress(order.shipping_address)}
              </p>
              <div style={{ display: "grid", gap: "4px", gridTemplateColumns: "1fr 1fr", marginTop: "8px", fontSize: "11px", color: "var(--cos-text-tertiary)" }}>
                <span>City: {field(order.shipping_address, "city")}</span>
                <span>State: {field(order.shipping_address, "state")}</span>
                <span>Postal: {field(order.shipping_address, "postalCode")}</span>
                <span>Country: {field(order.shipping_address, "country")}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "12px", borderRadius: "var(--cos-r-lg)", border: "1px solid var(--cos-border)", background: "rgba(255,255,255,0.02)" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cos-text-tertiary)", marginBottom: "8px" }}>
                Update status
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {statuses.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    className={`cos-btn ${order.order_status === status.value ? "cos-btn-primary" : "cos-btn-ghost"}`}
                    style={{ fontSize: "11px", padding: "6px 10px" }}
                    onClick={() => onStatusChange(order, status.value)}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              {(order.items ?? []).map((item, index) => (
                <div key={`${order.id}-${item.productId ?? "item"}-${index}`} style={{ display: "flex", gap: "10px", padding: "10px", borderRadius: "var(--cos-r-lg)", border: "1px solid var(--cos-border)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="cos-product-thumb" style={{ width: "64px", height: "64px" }}>
                    {item.image && (
                      <Image src={item.image} alt={item.title ?? "Product"} fill className="object-cover" sizes="64px" loading="lazy" quality={60} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, fontSize: "12px" }}>
                    <div style={{ fontWeight: 600, color: "var(--cos-text-primary)" }}>{item.title ?? "Product"}</div>
                    <div style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>
                      Qty {item.quantity ?? 1} · ₹{item.price ?? 0}
                      {item.selectedSize ? ` · Size ${item.selectedSize}` : ""}
                      {item.selectedColor ? ` · ${item.selectedColor}` : ""}
                    </div>
                    {item.sku && <div style={{ fontSize: "10px", color: "var(--cos-text-tertiary)", fontFamily: "var(--cos-mono)" }}>SKU: {item.sku}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function CosDetail({ icon: Icon, label, value }: { icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: "var(--cos-r)", border: "1px solid var(--cos-border-subtle)", background: "rgba(255,255,255,0.02)" }}>
      <p style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cos-text-tertiary)", marginBottom: "2px" }}>
        {Icon && <Icon style={{ width: 11, height: 11 }} />}
        {label}
      </p>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--cos-text-primary)", wordBreak: "break-word" }}>{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const tagClass = value === "delivered" ? "cos-tag-emerald" : value === "cancelled" ? "cos-tag-rose" : "cos-tag-amber";
  return <span className={`cos-tag ${tagClass}`}>{value}</span>;
}

function PaymentPill({ value }: { value: string }) {
  const tagClass = value.toLowerCase() === "paid" ? "cos-tag-emerald" : "cos-tag-sky";
  return <span className={`cos-tag ${tagClass}`}>{value}</span>;
}

function field(address: Record<string, unknown> | null | undefined, key: string) {
  const value = getAddressValue(address, key);
  return value ? String(value) : "N/A";
}

function formatAddress(address?: Record<string, unknown> | null) {
  if (!address) return "Not provided";
  return [
    getAddressValue(address, "line1"),
    getAddressValue(address, "line2"),
    getAddressValue(address, "landmark"),
    getAddressValue(address, "city"),
    getAddressValue(address, "state"),
    getAddressValue(address, "postalCode"),
    getAddressValue(address, "country"),
  ]
    .filter(Boolean)
    .map(String)
    .join(", ");
}

function getAddressValue(address: Record<string, unknown> | null | undefined, key: string) {
  if (!address) return null;
  const fallbackKeys: Record<string, string[]> = {
    line1: ["line1", "line_1"],
    line2: ["line2", "line_2"],
    postalCode: ["postalCode", "postal_code"],
  };
  for (const candidate of fallbackKeys[key] ?? [key]) {
    const value = address[candidate];
    if (value) return value;
  }
  return null;
}
