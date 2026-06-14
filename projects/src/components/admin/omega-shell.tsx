"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, Component, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Bolt,
  Box,
  CreditCard,
  Database,
  Globe,
  Layers,
  Mail,
  Menu,
  Mic,
  MousePointerClick,
  Search,
  Shield,
  Sparkles,
  Star,
  Truck,
  Users,
  Zap,
  X,
  Brain,
  ChevronRight,
  UserCircle,
} from "lucide-react";
import { CommandPalette } from "@/components/admin/command-palette";
import "@/styles/admin.css";

const navSections = [
  {
    title: "Command",
    links: [
      { href: "/dashboard-admin-vrixo-ravi", label: "Command Center", icon: Sparkles },
      { href: "/dashboard-admin-vrixo-ravi/analytics", label: "Intelligence", icon: Activity },
      { href: "/dashboard-admin-vrixo-ravi/enterprise", label: "Enterprise Ops", icon: Globe },
    ],
  },
  {
    title: "Commerce",
    links: [
      { href: "/dashboard-admin-vrixo-ravi/products", label: "Catalog", icon: Box },
      { href: "/dashboard-admin-vrixo-ravi/orders", label: "Orders", icon: Truck },
      { href: "/dashboard-admin-vrixo-ravi/customers", label: "Customers", icon: Users },
      { href: "/dashboard-admin-vrixo-ravi/coupons", label: "Promotions", icon: CreditCard },
      { href: "/dashboard-admin-vrixo-ravi/notifications", label: "Signals", icon: Bell },
    ],
  },
  {
    title: "Operations",
    links: [
      { href: "/dashboard-admin-vrixo-ravi/tickets", label: "Support", icon: Mail },
      { href: "/dashboard-admin-vrixo-ravi/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard-admin-vrixo-ravi/contacts", label: "Inbox", icon: BookOpen },
      { href: "/dashboard-admin-vrixo-ravi/shipping", label: "Logistics", icon: Truck },
    ],
  },
];

class OmegaErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    let msg = "System unavailable. Please refresh.";
    
    // Handle Error instances
    if (error instanceof Error) {
      msg = error.message || error.name || "Unknown error";
    }
    // Handle plain objects
    else if (error && typeof error === "object") {
      const e: any = error;
      // Check for message property first
      if (typeof e.message === "string" && e.message.trim().length > 0) {
        msg = e.message;
      }
      // Check for Event type
      else if (e.toString && e.toString() !== "[object Object]" && !e.toString().includes("[object")) {
        msg = e.toString();
      }
      // Check for Event-like properties
      else if (typeof e.type === "string" && e.type.length > 0) {
        msg = `System event: ${e.type}`;
      }
      // Try JSON stringify but guard against [object Event]
      else {
        try {
          const stringified = JSON.stringify(e);
          if (stringified && !stringified.includes("[object") && stringified.length < 100) {
            msg = stringified;
          }
        } catch {
          // Silent catch - use fallback
        }
      }
    }
    // Handle strings
    else if (typeof error === "string" && error.trim().length > 0 && !error.includes("[object")) {
      msg = error;
    }

    // Final safety check - never show [object Event] or [object Object]
    if (msg.includes("[object")) {
      msg = "System error encountered. Please refresh the page.";
    }

    return { hasError: true, error: msg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="omega-error-shell">
          <div className="omega-error-card">
            <div className="omega-error-icon">!</div>
            <div>
              <h2>Command System Failure</h2>
              <p>{this.state.error || "Please try again or contact support."}</p>
            </div>
            <button onClick={() => this.setState({ hasError: false, error: "" })} className="omega-btn omega-btn-primary">
              Reset Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function OmegaShell({ children }: { children: ReactNode; current?: string }) {
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [errorState, setErrorState] = useState<{ show: boolean; msg: string }>({ show: false, msg: "" });
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Global error handler
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      event.preventDefault();
      const msg = event.error?.message || event.message || "Unknown error occurred";
      console.error("[OmegaShell] Global error caught:", msg);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      event.preventDefault();
      const reason = event.reason;
      let msg = "Async operation failed";
      if (reason instanceof Error) {
        msg = reason.message;
      } else if (typeof reason === "string") {
        msg = reason;
      }
      console.error("[OmegaShell] Unhandled rejection:", msg);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    function handleHotkey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }

    window.addEventListener("keydown", handleHotkey);
    return () => window.removeEventListener("keydown", handleHotkey);
  }, []);

  return (
    <div className="omega-page">
      <div className="omega-grid-backdrop" />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <header className="omega-global-bar">
        <div className="omega-global-left">
          <button className="omega-menu-btn" onClick={() => setPanelOpen((value) => !value)}>
            <Menu className="omega-icon" />
          </button>
          <div className="omega-brand-mark">
            <div className="omega-icon-glow"><Sparkles className="omega-icon" /></div>
            <div>
              <div className="omega-brand-name">VRIXO OMEGA</div>
              <div className="omega-brand-caption">Commerce Operating System</div>
            </div>
          </div>
          <div className="omega-search-bar">
            <Search className="omega-search-icon" />
            <input type="search" placeholder="Search orders, products, signals..." aria-label="Global search" />
          </div>
        </div>

        <div className="omega-global-right">
          <button className="omega-pill"><Zap className="omega-pill-icon" /> Revenue Pulse</button>
          <button className="omega-pill"><Shield className="omega-pill-icon" /> System Health</button>
          <button className="omega-pill"><MousePointerClick className="omega-pill-icon" /> Quick Actions</button>
          <button className="omega-ghost-btn"><Mic className="omega-icon" /></button>
          <button className="omega-ghost-btn"><Bell className="omega-icon" /></button>
          <button className="omega-user-chip"><UserCircle className="omega-icon" /> Founder</button>
        </div>
      </header>

      <div className="omega-shell-grid">
        <aside className={`omega-left-rail ${panelOpen ? "open" : ""}`}>
          <div className="omega-rail-header">
            <div>
              <p className="omega-rail-label">AI Command Rail</p>
              <h1>Autonomous directives</h1>
            </div>
            <button className="omega-icon-btn" onClick={() => setPanelOpen(false)}><X className="omega-icon" /></button>
          </div>

          <div className="omega-rail-actions">
            <button 
              className={`omega-action-btn ${activeAction === "spike" ? "active" : ""}`}
              onClick={() => setActiveAction(activeAction === "spike" ? null : "spike")}
              title="View system alerts and spike notifications"
            >
              <Bolt className="omega-icon" /> Spike Alert
            </button>
            <button 
              className={`omega-action-btn ${activeAction === "forecast" ? "active" : ""}`}
              onClick={() => setActiveAction(activeAction === "forecast" ? null : "forecast")}
              title="View AI-powered forecasts and predictions"
            >
              <Brain className="omega-icon" /> AI Forecast
            </button>
            <button 
              className={`omega-action-btn ${activeAction === "bulk" ? "active" : ""}`}
              onClick={() => setActiveAction(activeAction === "bulk" ? null : "bulk")}
              title="Perform bulk operations on orders and products"
            >
              <Layers className="omega-icon" /> Bulk Ops
            </button>
            <button 
              className={`omega-action-btn ${activeAction === "pulse" ? "active" : ""}`}
              onClick={() => setActiveAction(activeAction === "pulse" ? null : "pulse")}
              title="View real-time data metrics and KPIs"
            >
              <Database className="omega-icon" /> Data Pulse
            </button>
          </div>

          <div className="omega-rail-nav">
            {navSections.map((section) => (
              <div key={section.title} className="omega-nav-group">
                <div className="omega-nav-title">{section.title}</div>
                {section.links.map((link) => {
                  const ActiveIcon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link key={link.href} href={link.href} className={`omega-nav-link ${active ? "active" : ""}`}>
                      <ActiveIcon className="omega-nav-link-icon" />
                      <span>{link.label}</span>
                      <ChevronRight className="omega-nav-chevron" />
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="omega-rail-footer">
            <div className="omega-footer-card">
              <div className="omega-footer-pill">Founder</div>
              <div className="omega-footer-label">Ravi Chavda</div>
              <p className="omega-footer-meta">Global commerce control</p>
            </div>
            <Link href="/api/admin/logout" className="omega-sidebar-link">Sign out</Link>
          </div>
        </aside>

        <main className="omega-main"> 
          <OmegaErrorBoundary>
            <div className="omega-main-frame">{children}</div>
          </OmegaErrorBoundary>
        </main>
      </div>
    </div>
  );
}
