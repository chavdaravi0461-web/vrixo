"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Loader2, User, Mail, Calendar, Shield, ArrowLeft, Save } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login?callbackUrl=/profile");
        return;
      }
      const u = session.user;
      setUser({
        email: u.email || "",
        name: u.user_metadata?.name || u.email?.split("@")[0] || "User",
        phone: u.user_metadata?.phone || "",
        created_at: u.created_at,
      });
      setName(u.user_metadata?.name || "");
      setPhone(u.user_metadata?.phone || "");

      // Fetch profile data
      fetch("/api/user/profile")
        .then(r => r.json())
        .then(d => {
          if (d?.user) {
            setUser(prev => ({ ...prev, ...d.user }));
            if (d.user.name) setName(d.user.name);
            if (d.user.phone) setPhone(d.user.phone);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [router]);

  async function handleSave(e) {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to update");
        return;
      }
      setMessage("Profile updated successfully!");
    } catch {
      setMessage("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: "12px", color: "var(--text-muted)", fontSize: "14px" }}>
        <Loader2 size={20} className="animate-spin" /> Loading profile...
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 20px" }}>
        <Link href="/account" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "14px", textDecoration: "none", marginBottom: "32px", transition: "color 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
          <ArrowLeft size={16} /> Back to account
        </Link>

        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: "32px" }}>Profile</h1>

        <div style={{ padding: "32px", borderRadius: "var(--radius)", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--accent)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
              <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>{user.email}</div>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "14px", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Phone number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "14px", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
            </div>
            {message && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px",
                background: message.includes("updated") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: message.includes("updated") ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)",
                color: message.includes("updated") ? "#10b981" : "#ef4444" }}>{message}</div>
            )}
            <button type="submit" disabled={saving} style={{
              padding: "12px 28px", borderRadius: "8px", border: "none",
              background: "var(--accent)", color: "var(--bg)",
              fontSize: "14px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: "8px",
            }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>

        <div style={{ padding: "32px", borderRadius: "var(--radius)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", marginBottom: "20px" }}>Account details</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { icon: Mail, label: "Email", value: user.email },
              { icon: Calendar, label: "Member since", value: user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Icon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</div>
                  <div style={{ fontSize: "14px", color: "var(--text)" }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
