"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  User, Package, Heart, LogOut, ShoppingBag, ChevronRight,
  HelpCircle, Ticket, Gift, MapPin, CreditCard, Bell, Loader2,
  Clock, Truck, CheckCircle2, XCircle, ExternalLink, ArrowLeft,
  Home, LayoutGrid, Settings, MessageSquare, Store
} from "lucide-react";

type UserProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar_url?: string;
  created_at?: string;
};

type OrderSummary = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  item_count: number;
};

const NAV_ITEMS = [
  { href: "/account", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/my-orders", label: "My Orders", icon: Package },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/coupons", label: "Coupons", icon: Ticket },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/support/tickets", label: "Support", icon: MessageSquare },
];

export default function AccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [stats, setStats] = useState({ orders: 0, wishlist: 0, coupons: 0 });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login?callbackUrl=/account");
        return;
      }

      const u = session.user;
      setUser({
        id: u.id,
        email: u.email || "",
        name: u.user_metadata?.name || u.email?.split("@")[0] || "User",
        phone: u.user_metadata?.phone || "",
        avatar_url: u.user_metadata?.avatar_url,
        created_at: u.created_at,
      });

      fetch("/api/user/profile").then(r => r.json()).then(d => {
        if (d?.name) setUser(prev => prev ? { ...prev, name: d.name, phone: d.phone || prev.phone } : prev);
      }).catch(() => {});

      fetch("/api/orders").then(r => r.json()).then(d => {
        const orders = Array.isArray(d) ? d : d?.orders || [];
        setRecentOrders(orders.slice(0, 5));
        setStats(prev => ({ ...prev, orders: orders.length }));
      }).catch(() => {});

      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered": return "#10b981";
      case "shipped": case "in_transit": return "#6366f1";
      case "processing": case "confirmed": return "#f59e0b";
      case "cancelled": case "returned": return "#ef4444";
      default: return "var(--text-muted)";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered": return CheckCircle2;
      case "shipped": case "in_transit": return Truck;
      case "cancelled": case "returned": return XCircle;
      default: return Clock;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-200px", right: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "var(--accent)", opacity: 0.02, filter: "blur(120px)" }} />
      </div>

      <div style={{
        display: "flex",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 20px 80px",
        position: "relative",
        zIndex: 1,
        gap: "24px",
      }}>

        {/* ─── SIDEBAR ─── */}
        <aside style={{
          width: "280px",
          flexShrink: 0,
          position: "sticky",
          top: "32px",
          alignSelf: "flex-start",
        }}>

          {/* Back to Store */}
          <Link href="/" style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: "20px",
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <Store size={16} />
            Back to Store
          </Link>

          {/* User Card */}
          <div style={{
            padding: "24px 20px",
            borderRadius: "14px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            marginBottom: "16px",
            textAlign: "center",
          }}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)", marginBottom: "14px" }} />
            ) : (
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "var(--accent)", color: "var(--bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em",
                margin: "0 auto 14px", flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", marginBottom: "4px", lineHeight: 1.3 }}>
              {user.name}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>

          {/* Navigation */}
          <nav style={{
            borderRadius: "14px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}>
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "13px 20px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    background: isActive ? "var(--glass)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--glass-hover, rgba(255,255,255,0.03))"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={17} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "13px 20px",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-muted)",
              fontSize: "14px",
              fontWeight: 500,
              cursor: signingOut ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              marginTop: "16px",
              opacity: signingOut ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!signingOut) { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* Welcome Banner */}
          <div style={{
            padding: "28px 32px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid var(--border)",
            marginBottom: "24px",
          }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              Welcome back, {user.name.split(" ")[0]} 👋
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              Here&apos;s a summary of your account activity.
            </p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Total Orders", value: stats.orders, icon: Package, color: "#6366f1", href: "/my-orders" },
              { label: "Wishlist", value: stats.wishlist, icon: Heart, color: "#ec4899", href: "/wishlist" },
              { label: "Coupons", value: stats.coupons, icon: Ticket, color: "#10b981", href: "/account/coupons" },
            ].map(({ label, value, icon: Icon, color, href }) => (
              <Link key={label} href={href} style={{
                padding: "20px",
                borderRadius: "14px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                transition: "all 0.25s ease",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: `${color}15`, border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{value}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent Orders */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Recent Orders
              </h2>
              {recentOrders.length > 0 && (
                <Link href="/my-orders" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                  View all <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {recentOrders.length === 0 ? (
              <div style={{
                padding: "40px 20px",
                borderRadius: "14px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                textAlign: "center",
              }}>
                <Package size={32} style={{ color: "var(--text-muted)", opacity: 0.4, margin: "0 auto 12px" }} />
                <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>No orders yet</p>
                <Link href="/" style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "var(--accent)",
                  color: "var(--bg)",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}>
                  Start Shopping
                </Link>
              </div>
            ) : (
              <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid var(--border)" }}>
                {/* Table Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 100px 100px 100px",
                  gap: "12px",
                  padding: "12px 20px",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  <span>Order</span>
                  <span>Items</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                </div>

                {/* Rows */}
                {recentOrders.map((order) => {
                  const StatusIcon = getStatusIcon(order.status);
                  const statusColor = getStatusColor(order.status);
                  return (
                    <div key={order.id} style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 100px 100px 100px",
                      gap: "12px",
                      padding: "14px 20px",
                      background: "var(--bg-card)",
                      borderBottom: "1px solid var(--border)",
                      alignItems: "center",
                      transition: "background 0.15s",
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-card)"}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        #{order.order_number}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                        {order.item_count} item{order.item_count !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: `${statusColor}12`,
                        color: statusColor,
                        fontSize: "11px",
                        fontWeight: 600,
                        width: "fit-content",
                        textTransform: "capitalize",
                      }}>
                        <StatusIcon size={12} />
                        {order.status?.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", textAlign: "right" }}>
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(order.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Links Grid */}
          <div>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>
              Quick Links
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {[
                { href: "/profile", label: "Personal Info", icon: User, desc: "Edit name, phone & email", color: "#6366f1" },
                { href: "/profile", label: "Addresses", icon: MapPin, desc: "Manage delivery addresses", color: "#f59e0b" },
                { href: "/support/tickets", label: "Help Center", icon: HelpCircle, desc: "Get support for orders", color: "#10b981" },
                { href: "/faq", label: "FAQs", icon: HelpCircle, desc: "Common questions", color: "#8b5cf6" },
              ].map(({ href, label, icon: Icon, desc, color }) => (
                <Link key={label} href={href} style={{
                  padding: "20px",
                  borderRadius: "14px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  transition: "all 0.25s ease",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "10px",
                    background: `${color}15`, border: `1px solid ${color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
