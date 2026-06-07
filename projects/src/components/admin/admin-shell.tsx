"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  TicketPercent,
  Truck,
  Users,
  Menu,
  Sparkles,
  Activity,
  Search,
  Headphones,
  Bell,
  UserCircle,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";
import "@/styles/admin.css";
import { CommandPalette } from "@/components/admin/command-palette";

const navSections = [
  {
    title: "Control",
    links: [
      { href: "/dashboard-admin-vrixo-ravi", label: "Command Center", icon: LayoutDashboard },
      { href: "/dashboard-admin-vrixo-ravi/analytics", label: "Intelligence", icon: BarChart3 },
      { href: "/dashboard-admin-vrixo-ravi/enterprise", label: "Enterprise Ops", icon: BrainCircuit },
    ],
  },
  {
    title: "Commerce",
    links: [
      { href: "/dashboard-admin-vrixo-ravi/products", label: "Catalog", icon: Package },
      { href: "/dashboard-admin-vrixo-ravi/orders", label: "Orders", icon: ShoppingCart },
      { href: "/dashboard-admin-vrixo-ravi/coupons", label: "Promotions", icon: TicketPercent },
      { href: "/dashboard-admin-vrixo-ravi/shipping", label: "Logistics", icon: Truck },
      { href: "/dashboard-admin-vrixo-ravi/returns", label: "Returns", icon: RefreshCw },
    ],
  },
  {
    title: "Relations",
    links: [
      { href: "/dashboard-admin-vrixo-ravi/tickets", label: "Tickets", icon: Headphones },
      { href: "/dashboard-admin-vrixo-ravi/customers", label: "Customers", icon: UserCircle },
      { href: "/dashboard-admin-vrixo-ravi/users", label: "Users", icon: Users },
      { href: "/dashboard-admin-vrixo-ravi/accounts", label: "Accounts", icon: Users },
      { href: "/dashboard-admin-vrixo-ravi/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard-admin-vrixo-ravi/contacts", label: "Inbox", icon: MessageSquare },
      { href: "/dashboard-admin-vrixo-ravi/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Growth",
    links: [
      { href: "/dashboard-admin-vrixo-ravi/newsletter", label: "Newsletter", icon: Mail },
      { href: "/dashboard-admin-vrixo-ravi/game", label: "Rewards Engine", icon: Gamepad2 },
    ],
  },
];

export function AdminShell({
  current: _current,
  children,
}: {
  current?: string;
  children: React.ReactNode;
}) {
  const pathname = _current ?? usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="os-page">
      {/* Animated grid background */}
      <div className="os-grid-bg" />

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* System Status Bar */}
      <header className="os-statusbar">
        <div className="os-statusbar-left">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--os-text-3)] hover:bg-[rgba(255,255,255,0.03)] lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="status-item">
            <span className="status-dot green" />
            <span className="hidden sm:inline">All systems nominal</span>
            <span className="sm:hidden">Live</span>
          </span>
          <span className="status-divider hidden sm:block" />
          <span className="status-item hidden sm:flex">
            <Activity className="h-3 w-3" />
            0 incidents
          </span>
          <span className="status-divider hidden sm:block" />
          <span className="status-item hidden md:flex">v2.0 · AI Core</span>
        </div>
        <div className="os-statusbar-right">
          <button
            className="os-cmd-trigger"
            onClick={() => setCmdOpen(true)}
          >
            <Search className="h-3 w-3" />
            <span className="cmd-label">Search...</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      {/* Shell */}
      <div className="flex">
        {/* Sidebar */}
        <aside className={`os-sidebar w-[220px] shrink-0 ${sidebarOpen ? "open" : ""}`}>
          <div className="os-sidebar-brand">
            <div className="brand-icon"><Sparkles className="h-3.5 w-3.5" /></div>
            <div>
              <div className="brand-text">Vrixo</div>
              <div className="brand-badge">AI OS v2.0</div>
            </div>
          </div>

          <nav className="os-nav">
            {navSections.map((section) => (
              <div key={section.title} className="os-nav-group">
                <div className="os-nav-group-title">{section.title}</div>
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`os-nav-link ${active ? "active" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="os-sidebar-footer">
            <div className="user-card">
              <div className="user-avatar">R</div>
              <div>
                <div className="user-name">Ravi Chavda</div>
                <div className="user-role">Founder</div>
              </div>
            </div>
            <div className="footer-actions">
              <Link href="/"><ExternalLink className="h-2.5 w-2.5" /> Store</Link>
              <Link href="/api/admin/logout"><LogOut className="h-2.5 w-2.5" /> Sign out</Link>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="relative z-10 flex-1 min-w-0">
          <div className="p-4 md:p-6 xl:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
