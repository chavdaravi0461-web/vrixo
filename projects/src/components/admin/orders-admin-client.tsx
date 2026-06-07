"use client";

import type { ComponentType } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const statuses = [
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
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

type OrdersPagination = {
  page: number;
  limit: number;
  total: number;
};

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
  filters
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

  const updateOrdersUrl = useCallback((updates: Record<string, string>) => {
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
      ...updates
    };

    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== "all" && !(key === "page" && value === "1") && !(key === "limit" && value === "20")) {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.replace(`/dashboard-admin-vrixo-ravi/orders${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [
    dateFrom,
    dateTo,
    orderStatus,
    pagination.limit,
    pagination.page,
    paymentMethod,
    paymentStatus,
    router,
    searchInput,
    sort
  ]);

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

  async function updateOrderStatus(order: AdminOrder, orderStatus: string) {
    const previousStatus = order.order_status;
    setOrderPatches((current) => ({ ...current, [order.id]: { order_status: orderStatus } }));

    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderStatus })
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
    <div className="space-y-4">
      <div className="os-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--os-text-3)]" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by order ID, name, phone, email, or Razorpay payment ID"
          className="h-10 rounded-lg border-[var(--os-border)] bg-[var(--os-surface-3)] pl-9 text-sm text-[var(--os-text)]"
        />
        </label>
        <div className="flex flex-wrap gap-2">
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); updateOrdersUrl({ order_status: event.target.value, page: "1" }); }}>
            <option value="all">All orders</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); updateOrdersUrl({ payment_status: event.target.value, page: "1" }); }}>
            <option value="all">All payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="cod_pending">COD pending</option>
          </select>
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); updateOrdersUrl({ payment_method: event.target.value, page: "1" }); }}>
            <option value="all">All methods</option>
            <option value="cod">COD</option>
            <option value="online">Online</option>
          </select>
          <input
            type="date"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              updateOrdersUrl({ date_from: event.target.value, page: "1" });
            }}
          />
          <input
            type="date"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              updateOrdersUrl({ date_to: event.target.value, page: "1" });
            }}
          />
          <select className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={sort} onChange={(event) => { setSort(event.target.value); updateOrdersUrl({ sort: event.target.value, page: "1" }); }}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="total-desc">Highest total</option>
            <option value="total-asc">Lowest total</option>
          </select>
        </div>
        </div>
      </div>

      {visibleOrders.map((order) => (
        <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} />
      ))}

      {pageCount > 1 ? (
        <div className="os-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--os-text-3)]">
            Showing {visibleOrders.length} of {pagination.total} matching orders.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={currentPage <= 1} onClick={() => updateOrdersUrl({ page: String(currentPage - 1) })}>
              Previous
            </Button>
            <span className="text-sm font-bold text-[var(--os-text-2)]">
              Page {currentPage} of {pageCount}
            </span>
            <Button type="button" variant="outline" disabled={currentPage >= pageCount} onClick={() => updateOrdersUrl({ page: String(currentPage + 1) })}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {pagination.total === 0 ? (
        <div className="os-card p-8 text-center text-[var(--os-text-3)]">
          No matching orders found.
        </div>
      ) : null}
    </div>
  );
}

const OrderCard = memo(function OrderCard({
  order,
  onStatusChange
}: {
  order: AdminOrder;
  onStatusChange: (order: AdminOrder, orderStatus: string) => Promise<void>;
}) {
  return (
    <div className="os-card os-row p-4 md:p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--os-text-3)]">
                {order.order_number}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[var(--os-text)]">{order.customer_name}</h2>
                <StatusPill value={order.order_status} />
                <PaymentPill value={order.payment_status ?? "pending"} />
              </div>
              <p className="mt-2 inline-flex rounded-lg bg-[var(--os-accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--os-accent)]">
                Total ₹{order.total}
              </p>

              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <Detail icon={UserRound} label="Customer name" value={order.customer_name || "Not provided"} />
                <Detail label="Mobile number" value={order.customer_phone || "Not provided"} />
                <Detail label="Email" value={order.customer_email || "Not provided"} />
                <Detail
                  icon={CalendarClock}
                  label="Order date"
                  value={order.created_at ? new Date(order.created_at).toLocaleString("en-IN") : "Not available"}
                />
                <Detail icon={CreditCard} label="Payment method" value={order.payment_method ?? "cod"} />
                <Detail label="Payment status" value={order.payment_status ?? "pending"} />
                <Detail label="WhatsApp status" value={order.whatsapp_status ?? "pending"} />
                <Detail label="SMS status" value={order.sms_status ?? "pending"} />
                <Detail label="Razorpay order ID" value={order.razorpay_order_id || "Not applicable"} />
                <Detail label="Razorpay payment ID" value={order.razorpay_payment_id || "Not applicable"} />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Full checkout address
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {formatAddress(order.shipping_address)}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <span>City: {field(order.shipping_address, "city")}</span>
                  <span>State: {field(order.shipping_address, "state")}</span>
                  <span>Postal code: {field(order.shipping_address, "postalCode")}</span>
                  <span>Country: {field(order.shipping_address, "country")}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Update status</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <Button
                    key={status.value}
                    variant={order.order_status === status.value ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onStatusChange(order, status.value)}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
              </div>

              <div className="space-y-3">
                {(order.items ?? []).map((item, index) => (
                  <div key={`${order.id}-${item.productId ?? "item"}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 p-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title ?? "Product"}
                          fill
                          className="object-cover"
                          sizes="80px"
                          loading="lazy"
                          quality={60}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-slate-950">{item.title ?? "Product"}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        Product ID: {item.productId ?? "Not available"}
                      </p>
                      {item.sku ? <p className="mt-1 text-xs text-slate-500">SKU: {item.sku}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {item.quantity ?? 1} | Rs. {item.price ?? 0}
                        {item.selectedSize ? ` | Size ${item.selectedSize}` : ""}
                        {item.selectedColor ? ` | Color ${item.selectedColor}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
  );
});

function Detail({
  icon: Icon,
  label,
  value
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      <p className="mt-1 break-words font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const styles = value === "delivered" ? "bg-emerald-50 text-emerald-700" : value === "cancelled" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-2xl px-3 py-1 text-xs font-black capitalize ${styles}`}>{value}</span>;
}

function PaymentPill({ value }: { value: string }) {
  const styles = value.toLowerCase() === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-2xl px-3 py-1 text-xs font-black capitalize ${styles}`}>{value}</span>;
}

function field(address: Record<string, unknown> | null | undefined, key: string) {
  const value = getAddressValue(address, key);
  return value ? String(value) : "Not provided";
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
    getAddressValue(address, "country")
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
    postalCode: ["postalCode", "postal_code"]
  };

  for (const candidate of fallbackKeys[key] ?? [key]) {
    const value = address[candidate];
    if (value) return value;
  }

  return null;
}
