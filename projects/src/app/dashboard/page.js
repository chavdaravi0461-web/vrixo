"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Calendar, Shield, Activity, ArrowLeft } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/dashboard");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchProfile();
  }, [status]);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) { const d = await res.json(); setProfileData(d.user); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", gap: "12px", color: "var(--text-muted)", fontSize: "14px" }}>
        <Loader2 size={20} className="animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (!session?.user) return null;

  const statCards = [
    { label: "Member since", value: profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "N/A", icon: Calendar },
    { label: "Account type", value: profileData?.role === "admin" ? "Admin" : "Standard", icon: Shield },
    { label: "Provider", value: profileData?.provider === "google" ? "Google" : "Email", icon: Activity },
    { label: "Last login", value: profileData?.lastLogin ? new Date(profileData.lastLogin).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A", icon: User },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div style={{ maxWidth: "840px", margin: "0 auto", padding: "40px 20px" }}>
        <Link href="/account" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "14px", textDecoration: "none", marginBottom: "32px", transition: "color 0.2s" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
          <ArrowLeft size={16} /> Back to account
        </Link>

        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px" }}>Welcome back, {session.user.name?.split(" ")[0] || "there"}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass-card" style={{ padding: "24px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <Icon size={16} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{label}</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: "32px", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Quick links</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
            {[
              { href: "/my-orders", label: "My orders" },
              { href: "/wishlist", label: "Wishlist" },
              { href: "/profile", label: "Edit profile" },
              { href: "/shop", label: "Browse shop" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                style={{ display: "block", padding: "14px 16px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 500, textDecoration: "none", textAlign: "center", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--card-bg)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Account information</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "Name", value: session.user.name },
              { label: "Email", value: session.user.email },
              { label: "Role", value: profileData?.role === "admin" ? "Admin" : "User" },
              { label: "Sign-in method", value: profileData?.provider === "google" ? "Google" : "Email & password" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
