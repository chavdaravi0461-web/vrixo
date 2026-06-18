"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bolt,
  Brain,
  Box,
  CreditCard,
  Globe,
  Hash,
  Layers,
  Mail,
  Package,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Truck,
  Users,
  Zap,
  TrendingUp,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "danger" | "warn" | "info";
};

const navCore: NavItem[] = [
  { href: "/dashboard-admin-vrixo-ravi", label: "Command Center", icon: Sparkles },
  { href: "/dashboard-admin-vrixo-ravi/analytics", label: "Intelligence", icon: Activity },
  { href: "/dashboard-admin-vrixo-ravi/enterprise", label: "Enterprise", icon: Globe },
];

const navCommerce: NavItem[] = [
  { href: "/dashboard-admin-vrixo-ravi/products", label: "Catalog", icon: Box },
  { href: "/dashboard-admin-vrixo-ravi/orders", label: "Orders", icon: Truck },
  { href: "/dashboard-admin-vrixo-ravi/customers", label: "Customers", icon: Users },
  { href: "/dashboard-admin-vrixo-ravi/coupons", label: "Promotions", icon: CreditCard },
];

const navOps: NavItem[] = [
  { href: "/dashboard-admin-vrixo-ravi/notifications", label: "Signals", icon: Bell },
  { href: "/dashboard-admin-vrixo-ravi/tickets", label: "Support", icon: Mail },
  { href: "/dashboard-admin-vrixo-ravi/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard-admin-vrixo-ravi/contacts", label: "Inbox", icon: Hash },
  { href: "/dashboard-admin-vrixo-ravi/shipping", label: "Logistics", icon: Package },
];

const railActions = [
  { icon: Bolt, label: "Spike Alert", href: "/dashboard-admin-vrixo-ravi/orders?order_status=pending", color: "var(--cos-amber)" },
  { icon: Brain, label: "AI Forecast", href: "/dashboard-admin-vrixo-ravi/analytics", color: "var(--cos-accent)" },
  { icon: Layers, label: "Bulk Ops", href: "/dashboard-admin-vrixo-ravi/products", color: "var(--cos-emerald)" },
  { icon: BarChart3, label: "Data Pulse", href: "/dashboard-admin-vrixo-ravi/analytics", color: "var(--cos-sky)" },
];

export function CommerceOSShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        window.location.href = `/dashboard-admin-vrixo-ravi/orders?search=${encodeURIComponent(searchQuery.trim())}`;
      }
    },
    [searchQuery]
  );

  function isActive(href: string) {
    if (href === "/dashboard-admin-vrixo-ravi") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="cos-page">
      <div className="cos-ambient" />
      <div className="cos-grid-lines" />
      <div className="cos-neural-line" />

      <header className="cos-bar">
        <div className="cos-bar-left">
          <Link href="/dashboard-admin-vrixo-ravi" className="cos-brand">
            <div className="cos-brand-icon">
              <Sparkles style={{ width: 18, height: 18, color: "#a5b4fc" }} />
            </div>
            <div>
              <div className="cos-brand-text">Vrixo Omega</div>
              <div className="cos-brand-sub">Commerce OS</div>
            </div>
          </Link>
        </div>

        <div className="cos-bar-center">
          <div className="cos-search">
            <Search style={{ width: 15, height: 15, color: "var(--cos-text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search orders, products, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearch}
            />
            <span className="cos-search-kbd">/</span>
          </div>
        </div>

        <div className="cos-bar-right">
          <span className="cos-pill cos-pill-live">
            <span style={{ fontSize: "10px", fontFamily: "var(--cos-mono)" }}>{currentTime}</span>
          </span>
          <button className="cos-pill">
            <Zap style={{ width: 14, height: 14 }} />
            Revenue
          </button>
          <button className="cos-pill">
            <Shield style={{ width: 14, height: 14 }} />
            Health
          </button>
          <button className="cos-ghost">
            <Bell style={{ width: 16, height: 16 }} />
          </button>
          <button className="cos-ghost">
            <Settings style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </header>

      <div className="cos-layout">
        <aside className="cos-rail">
          <div className="cos-rail-header">
            <div className="cos-rail-title">AI Command Rail</div>
            <div className="cos-rail-subtitle">Autonomous directives</div>
          </div>

          <div className="cos-rail-actions">
            {railActions.map((action) => (
              <Link key={action.label} href={action.href} className="cos-rail-action">
                <action.icon style={{ color: action.color }} />
                {action.label}
              </Link>
            ))}
          </div>

          <NavSection title="Command" items={navCore} isActive={isActive} />
          <NavSection title="Commerce" items={navCommerce} isActive={isActive} />
          <NavSection title="Operations" items={navOps} isActive={isActive} />

          <div className="cos-rail-footer">
            <div className="cos-rail-user">
              <div className="cos-rail-avatar">R</div>
              <div>
                <div className="cos-rail-user-name">Ravi Chavda</div>
                <div className="cos-rail-user-role">Founder & CEO</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="cos-center">
          {children}
        </main>

        <aside className="cos-insight">
          <InsightSection
            icon={Brain}
            iconBg="var(--cos-accent-dim)"
            iconColor="var(--cos-accent)"
            title="AI Insights"
          >
            <InsightItem label="Revenue forecast" value="Strong upward trend" tag="emerald" />
            <InsightItem label="Stock alert" value="3 SKUs need restock" tag="amber" />
            <InsightItem label="Conversion" value="Up 12% this week" tag="accent" />
          </InsightSection>

          <InsightSection
            icon={TrendingUp}
            iconBg="var(--cos-emerald-dim)"
            iconColor="var(--cos-emerald)"
            title="Growth Signals"
          >
            <InsightItem label="New customers" value="+23 this week" tag="sky" />
            <InsightItem label="Repeat rate" value="34% returning buyers" tag="emerald" />
            <InsightItem label="AOV trend" value="Stable at Rs 2,400" tag="accent" />
          </InsightSection>

          <InsightSection
            icon={Shield}
            iconBg="var(--cos-rose-dim)"
            iconColor="var(--cos-rose)"
            title="Risk Monitor"
          >
            <InsightItem label="Fraud signals" value="0 flagged orders" tag="emerald" />
            <InsightItem label="Failed payments" value="2 pending retry" tag="amber" />
          </InsightSection>

          <div className="cos-feed" style={{ flex: 1 }}>
            <div className="cos-feed-header">
              <span style={{ fontSize: "11px", fontWeight: 700 }}>Live Feed</span>
              <span className="cos-tag cos-tag-emerald">Live</span>
            </div>
            <div className="cos-feed-list">
              <FeedItem dot="success" text="Order <strong>#VX-4521</strong> confirmed" time="2m ago" />
              <FeedItem dot="info" text="New customer <strong>Priya M.</strong> registered" time="5m ago" />
              <FeedItem dot="success" text="Payment <strong>Rs 3,200</strong> received" time="8m ago" />
              <FeedItem dot="warn" text="Low stock: <strong>Nike Air Max</strong>" time="12m ago" />
              <FeedItem dot="info" text="Product <strong>Omega Watch</strong> updated" time="15m ago" />
              <FeedItem dot="success" text="Order <strong>#VX-4520</strong> shipped" time="18m ago" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NavSection({
  title,
  items,
  isActive,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="cos-rail-section">
      <div className="cos-rail-section-title">{title}</div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`cos-nav-item ${isActive(item.href) ? "active" : ""}`}
        >
          <item.icon />
          <span>{item.label}</span>
          {item.badge ? (
            <span className={`cos-nav-badge cos-nav-badge-${item.badgeTone ?? "info"}`}>
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function InsightSection({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="cos-insight-section">
      <div className="cos-insight-header">
        <div className="cos-insight-icon" style={{ background: iconBg }}>
          <Icon style={{ width: 14, height: 14, color: iconColor }} />
        </div>
        <div className="cos-insight-title">{title}</div>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>{children}</div>
    </div>
  );
}

function InsightItem({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
      <span style={{ fontSize: "11px", color: "var(--cos-text-tertiary)" }}>{label}</span>
      <span className={`cos-tag cos-tag-${tag}`}>{value}</span>
    </div>
  );
}

function FeedItem({ dot, text, time }: { dot: "info" | "success" | "warn" | "danger"; text: string; time: string }) {
  return (
    <div className="cos-feed-item">
      <div className={`cos-feed-dot cos-feed-dot-${dot}`} />
      <div>
        <div className="cos-feed-text">{text}</div>
        <div className="cos-feed-time">{time}</div>
      </div>
    </div>
  );
}
