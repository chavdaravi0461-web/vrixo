"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CouponsAdminClient({
  coupons
}: {
  coupons: Array<{ id: string; code: string; description: string; discount_type: string; discount_value: number }>;
}) {
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "10",
    minOrderAmount: "1000",
    active: true
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="admin-table-card p-6">
        <h1 className="text-3xl font-black text-slate-950">Coupons</h1>
        <div className="mt-6 space-y-4">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-black text-slate-950">{coupon.code}</h2>
              <p className="mt-1 text-sm text-slate-500">{coupon.description}</p>
              <p className="mt-2 text-sm text-slate-700">
                {coupon.discount_type} / {coupon.discount_value}
              </p>
            </div>
          ))}
        </div>
      </div>
      <form
        className="admin-card p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/admin/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              discountValue: Number(form.discountValue),
              minOrderAmount: Number(form.minOrderAmount)
            })
          });
          const payload = await response.json();
          if (!response.ok) {
            toast.error(payload.message ?? "Coupon creation failed.");
            return;
          }
          toast.success("Coupon created.");
          location.reload();
        }}
      >
        <h2 className="text-3xl font-black text-slate-950">Create coupon</h2>
        <div className="mt-6 grid gap-4">
          <Input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Input placeholder="Discount type" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })} />
          <Input placeholder="Discount value" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} />
          <Input placeholder="Minimum order amount" value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })} />
        </div>
        <Button type="submit" className="mt-6 h-12 w-full rounded-2xl">
          Save coupon
        </Button>
      </form>
    </div>
  );
}
