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
      router.replace("/dashboard-admin-vrixo-ravi");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="os-card p-5 md:p-6" onSubmit={submitLogin}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--os-accent-soft)] text-[var(--os-accent)]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[var(--os-text)]">Admin login</h2>
          <p className="mt-0.5 text-[10px] text-[var(--os-text-3)]">Use your admin email/password first.</p>
        </div>
      </div>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-[10px] font-semibold text-[var(--os-text-2)]">Admin email or mobile</span>
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
