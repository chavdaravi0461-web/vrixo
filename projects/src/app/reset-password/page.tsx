"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    // Method 1: PKCE code exchange
    if (code) {
      const supabase = createBrowserSupabaseClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data: sessionData, error: exchangeError }) => {
        if (exchangeError) {
          console.error("[reset-password] exchange error:", exchangeError);
          setError("Invalid or expired reset link. Please request a new one.");
        } else {
          setVerified(true);
          setUserEmail(sessionData?.session?.user?.email || "");
          window.history.replaceState({}, "", "/reset-password");
        }
        setVerifying(false);
      });
      return;
    }

    // Method 2: Hash fragment tokens (older Supabase magic links)
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const hashAccessToken = params.get("access_token");
      const hashRefreshToken = params.get("refresh_token");

      if (hashAccessToken && hashRefreshToken) {
        const supabase = createBrowserSupabaseClient();
        supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken,
        }).then(({ data: sessionData, error }) => {
          if (error) {
            setError("Invalid or expired reset link. Please request a new one.");
          } else {
            setVerified(true);
            setUserEmail(sessionData?.session?.user?.email || "");
          }
          setVerifying(false);
        });
        return;
      }
    }

    // Method 3: Query param tokens
    if (accessToken && refreshToken) {
      const supabase = createBrowserSupabaseClient();
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ data: sessionData, error }) => {
        if (error) {
          setError("Invalid or expired reset link. Please request a new one.");
        } else {
          setVerified(true);
          setUserEmail(sessionData?.session?.user?.email || "");
        }
        setVerifying(false);
      });
      return;
    }

    // No auth params — check if already logged in
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setVerified(true);
        setUserEmail(session.user?.email || "");
      } else {
        setError("No reset link found. Please request a new one.");
      }
      setVerifying(false);
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDone(true);
      toast.success("Password updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card" style={{ width: "100%", maxWidth: "420px", padding: "40px", textAlign: "center" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 16px" }} />
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (error && !verified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card" style={{ width: "100%", maxWidth: "420px", padding: "40px", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <AlertCircle size={24} style={{ color: "#ef4444" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: "8px" }}>
            Link expired
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
            {error}
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: "block",
              width: "100%",
              padding: "14px 20px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "420px", padding: "40px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(99,102,241,0.1)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Lock size={22} style={{ color: "var(--accent)" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Set new password
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: 1.6 }}>
            Choose a strong password for your account.
          </p>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                marginBottom: "24px",
              }}
            >
              <CheckCircle2 size={32} style={{ color: "#10b981", margin: "0 auto 8px" }} />
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#10b981" }}>Password updated!</p>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                You can now sign in with your new password.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent)",
                color: "var(--bg-primary)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", marginBottom: "16px" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                New password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  autoFocus
                  autoComplete="new-password"
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: "4px",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label style={{ display: "block", marginBottom: "24px" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Confirm password
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {password && confirmPassword && password !== confirmPassword && (
                <span style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", display: "block" }}>
                  Passwords do not match
                </span>
              )}
            </label>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent)",
                color: "var(--bg-primary)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading || !password || !confirmPassword ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "420px", padding: "40px", textAlign: "center" }}>
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 16px" }} />
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
