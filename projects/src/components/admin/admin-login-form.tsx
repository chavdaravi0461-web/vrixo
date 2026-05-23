"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, accessCode })
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Admin login failed.");
      }

      toast.success("Admin access verified.");
      router.replace("/dashboard-admin-dreamcart-ravi");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="admin-card p-6 md:p-8" onSubmit={submitLogin}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-700 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">Admin login</h2>
          <p className="mt-1 text-sm text-slate-500">Use your admin email/password first.</p>
        </div>
      </div>
      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Admin email or mobile</span>
        <Input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="admin@example.com"
          autoComplete="username"
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          className="pr-12"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Admin access code</span>
        <Input
          type="password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="Required when enabled"
          autoComplete="one-time-code"
        />
      </label>
      <Button type="submit" className="mt-6 h-12 w-full rounded-2xl" disabled={loading}>
        {loading ? "Verifying..." : "Login to admin"}
      </Button>
    </form>
  );
}
