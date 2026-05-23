"use client";

import { useState } from "react";
import { IndianRupee, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { ShippingSettings } from "@/lib/order-pricing";

export function ShippingSettingsClient({ settings }: { settings: ShippingSettings }) {
  const [mode, setMode] = useState<ShippingSettings["mode"]>(settings.mode);
  const [shippingCharge, setShippingCharge] = useState(String(settings.shippingCharge));
  const [saving, setSaving] = useState(false);
  const charge = Math.max(0, Number(shippingCharge) || 0);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/admin/shipping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          shippingCharge: charge,
          freeShippingThreshold: 0
        })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Shipping settings could not be saved.");
      }

      toast.success(payload?.message ?? "Shipping settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shipping settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="overflow-hidden admin-table-card">
        <div className="admin-hero rounded-none p-6 text-white">
          <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Delivery control</p>
          <h1 className="mt-2 text-4xl font-black">Shipping Charge</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Set the delivery fee and the order value where Vrixo automatically gives free delivery.
          </p>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <PreviewCard
            label="Current delivery mode"
            value={mode === "free" ? "Free" : "Paid"}
            description={
              mode === "free"
                ? "Every order gets free delivery."
                : `Charge ${formatCurrency(charge)} on each order.`
            }
          />
          <PreviewCard
            label="Checkout shipping"
            value={mode === "free" ? "Free" : formatCurrency(charge)}
            description={
              mode === "free"
                ? "Shipping is free for all cart values."
                : "This manual delivery price is added at cart and checkout."
            }
          />
        </div>
      </section>

      <form className="admin-card p-5" onSubmit={saveSettings}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">Delivery rule</h2>
            <p className="mt-1 text-sm text-slate-500">Choose free delivery or paid delivery manually.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-md border p-4 text-left transition ${
                mode === "free"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMode("free")}
            >
              <span className="block text-sm font-bold">Free delivery</span>
              <span className="mt-1 block text-xs">No delivery charge on any order.</span>
            </button>
            <button
              type="button"
              className={`rounded-md border p-4 text-left transition ${
                mode === "paid"
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMode("paid")}
            >
              <span className="block text-sm font-bold">Manual price</span>
              <span className="mt-1 block text-xs">Set one delivery charge for orders.</span>
            </button>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Manual shipping charge</span>
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="number"
                min="0"
                value={shippingCharge}
                onChange={(event) => setShippingCharge(event.target.value)}
                className="pl-10"
                disabled={mode === "free"}
                required
              />
            </div>
          </label>
          <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900">
            {mode === "free"
              ? "Customers get free delivery on every order."
              : `Customers pay ${formatCurrency(charge)} shipping on each order.`}
          </div>
          <Button type="submit" className="h-12 rounded-md" disabled={saving}>
            {saving ? "Saving..." : "Save shipping settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PreviewCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
