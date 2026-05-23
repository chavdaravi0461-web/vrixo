"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminAccessGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await fetch("/api/admin/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Access denied.");
      }

      toast.success("Admin access unlocked.");
      router.replace(searchParams.get("next") || "/dashboard-admin-dreamcart-ravi");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Access denied.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="rounded-[2rem] bg-white p-8 card-shadow" onSubmit={submitCode}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-white">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">Admin security check</h2>
          <p className="mt-1 text-sm text-slate-500">Enter the private admin access code.</p>
        </div>
      </div>
      <Input
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Admin access code"
        className="mt-6"
        autoComplete="one-time-code"
        required
      />
      <Button type="submit" className="mt-5 w-full" disabled={loading}>
        {loading ? "Checking..." : "Unlock admin"}
      </Button>
    </form>
  );
}
