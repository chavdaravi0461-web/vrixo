"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function SignupForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setFormError("");
    await signIn("google", { callbackUrl: "/shop" });
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess("");

    if (!name || !email || !password) {
      setFormError("Please fill in all fields");
      return;
    }

    if (name.length < 2) {
      setFormError("Name must be at least 2 characters");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/password-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone: "0000000000" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      setSuccess("Account created! Signing you in...");
      router.push(data.redirectTo || "/shop");
      router.refresh();
    } catch (err) {
      setFormError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const isSubmitting = loading || googleLoading;

  return (
    <div className="glass-card" style={{ padding: "40px" }}>
      <div className="text-center mb-8">
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Create your account
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px" }}>
          Join Vrixo for a premium shopping experience
        </p>
      </div>

      {formError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {formError}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
            color: "#22c55e",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {success}
        </div>
      )}

      <button
        onClick={handleGoogleSignup}
        disabled={isSubmitting}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: "15px",
          fontWeight: 500,
          cursor: isSubmitting ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          transition: "all 0.2s ease",
          opacity: isSubmitting ? 0.6 : 1,
        }}
        onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = "var(--card-bg)"; }}
        onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.background = "var(--bg-elevated)"; }}
      >
        {googleLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        {googleLoading ? "Creating account..." : "Sign up with Google"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "24px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <span style={{ color: "var(--text-muted)", fontSize: "13px", whiteSpace: "nowrap" }}>
          or sign up with email
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      </div>

      <form onSubmit={handleEmailSignup}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              htmlFor="signup-name"
              style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Full name
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <div>
            <label
              htmlFor="signup-email"
              style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <div>
            <label
              htmlFor="signup-password"
              style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: "8px",
            border: "none",
            background: "var(--accent)",
            color: "var(--bg-primary)",
            fontSize: "15px",
            fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            marginTop: "20px",
            opacity: isSubmitting ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Loader2 size={18} className="animate-spin" />
              Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
        Already have an account?{" "}
          <Link
            href="/login"
          style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
