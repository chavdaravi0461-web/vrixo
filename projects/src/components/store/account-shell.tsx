"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useState } from "react";
import { User, ShoppingBag, Heart, Ticket, Gift, LogOut, Loader2 } from "lucide-react";

const accountLinks = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/my-orders", label: "My Orders", icon: ShoppingBag },
  { href: "/account/coupons", label: "My Coupons", icon: Gift },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

export function AccountShell({ current, showLogout = false, children }: { current: string; showLogout?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "240px 1fr" }}>

          {/* Sidebar */}
          <aside style={{
            position: "sticky", top: "96px", alignSelf: "start",
            padding: "20px", borderRadius: "var(--radius)",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            height: "fit-content",
          }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", marginBottom: "16px" }}>
              My Account
            </h2>
            <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {accountLinks.map((link) => {
                const Icon = link.icon;
                const isActive = current === link.href;
                return (
                  <Link key={link.href} href={link.href} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 12px", borderRadius: "10px",
                    textDecoration: "none", fontSize: "13px", fontWeight: 500,
                    transition: "all 0.2s",
                    background: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "var(--bg)" : "var(--text-secondary)",
                  }}>
                    <Icon size={16} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {showLogout && (
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  marginTop: "16px", width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  padding: "10px 12px", borderRadius: "10px",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text-muted)", fontSize: "13px", fontWeight: 500,
                  cursor: signingOut ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            )}
          </aside>

          {/* Content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
