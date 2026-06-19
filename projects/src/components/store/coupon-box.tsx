"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/lib/store/cart-store";

export function CouponBox({ subtotal }: { subtotal: number }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const setCoupon = useCartStore((state) => state.setCoupon);

  return (
    <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Apply coupon</p>
      <div className="mt-3 flex gap-3">
        <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter coupon code" />
        <Button
          type="button"
          variant="secondary"
          disabled={loading || !code}
          onClick={async () => {
            setLoading(true);
            try {
              const response = await fetch("/api/coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, subtotal })
              });
              const payload = await response.json().catch(() => ({ message: "Invalid server response." }));
              if (!response.ok) {
                toast.error(payload.message ?? "Invalid coupon.");
                return;
              }
              setCoupon(payload.code, payload.discount);
              toast.success(`Coupon ${payload.code} applied.`);
            } catch {
              toast.error("Network error. Please try again.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
