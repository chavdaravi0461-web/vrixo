"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Mail, Loader2, CheckCircle2, Shield } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      const channels = data.channels;
      if (channels && channels.length > 0 && channels[0].channel === "email") {
        const sendRes = await fetch("/api/auth/send-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            channel: "email",
            userId: data.userId,
            name: data.name
          }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.message);
      }

      setSentEmail(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "40px" }}>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: "24px",
          }}
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <CheckCircle2 size={30} style={{ color: "#10b981" }} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: "8px" }}>
              Check your email
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "28px" }}>
              We&apos;ve sent a password reset link to <strong style={{ color: "var(--text-primary)" }}>{sentEmail}</strong>
            </p>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
                marginBottom: "24px",
                textAlign: "left",
              }}
            >
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: "var(--text-primary)" }}>Didn&apos;t receive it?</strong> Check your spam folder or{" "}
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#6366f1",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  try another email
                </button>
                .
              </p>
            </div>

            <Link
              href="/login"
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
                letterSpacing: "-0.01em",
              }}
            >
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                <Shield size={24} style={{ color: "#6366f1" }} />
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <label style={{ display: "block", marginBottom: "20px" }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Email address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </label>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading || !email.trim() ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  letterSpacing: "-0.01em",
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? "Sending reset link..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        {!sent && (
          <p style={{ textAlign: "center", marginTop: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
            Remember your password?{" "}
            <Link href="/login" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
