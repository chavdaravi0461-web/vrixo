"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  Gamepad2,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Package,
  Search,
  ShoppingCart,
  Star,
  TicketPercent,
  Truck,
  Users,
  Command,
} from "lucide-react";

const actions = [
  { section: "Navigate", items: [
    { label: "Command Center", href: "/dashboard-admin-vrixo-ravi", icon: LayoutDashboard },
    { label: "Analytics", href: "/dashboard-admin-vrixo-ravi/analytics", icon: BarChart3 },
    { label: "Enterprise Ops", href: "/dashboard-admin-vrixo-ravi/enterprise", icon: BrainCircuit },
    { label: "Catalog", href: "/dashboard-admin-vrixo-ravi/products", icon: Package },
    { label: "Orders", href: "/dashboard-admin-vrixo-ravi/orders", icon: ShoppingCart },
    { label: "Promotions", href: "/dashboard-admin-vrixo-ravi/coupons", icon: TicketPercent },
    { label: "Logistics", href: "/dashboard-admin-vrixo-ravi/shipping", icon: Truck },
    { label: "Users", href: "/dashboard-admin-vrixo-ravi/users", icon: Users },
    { label: "Accounts", href: "/dashboard-admin-vrixo-ravi/accounts", icon: Users },
    { label: "Reviews", href: "/dashboard-admin-vrixo-ravi/reviews", icon: Star },
    { label: "Inbox", href: "/dashboard-admin-vrixo-ravi/contacts", icon: MessageSquare },
    { label: "Newsletter", href: "/dashboard-admin-vrixo-ravi/newsletter", icon: Mail },
    { label: "Rewards Engine", href: "/dashboard-admin-vrixo-ravi/game", icon: Gamepad2 },
  ]},
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const flatItems = actions.flatMap((g) => g.items);
  const filtered = flatItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIdx]) {
      router.push(filtered[selectedIdx].href);
      onClose();
    }
    if (e.key === "Escape") onClose();
  }

  if (!open) return null;

  return (
    <div className="os-cmd-overlay" onClick={onClose}>
      <div className="os-cmd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="os-cmd-input">
          <Search className="h-4 w-4 text-[var(--os-text-3)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <span className="text-[10px] font-medium text-[var(--os-text-3)] shrink-0 flex items-center gap-1">
            <Command className="h-3 w-3" />K
          </span>
        </div>
        <div className="os-cmd-results">
          {filtered.length > 0 ? (
            actions.map((group) => {
              const items = group.items.filter((i) =>
                i.label.toLowerCase().includes(query.toLowerCase())
              );
              if (!items.length) return null;
              return (
                <div key={group.section} className="os-cmd-group">
                  {!query && <div className="os-cmd-group-title">{group.section}</div>}
                  {items.map((item, idx) => {
                    const globalIdx = filtered.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.href}
                        className={`os-cmd-item ${globalIdx === selectedIdx ? "selected" : ""}`}
                        onClick={() => { router.push(item.href); onClose(); }}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-sm text-[var(--os-text-3)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
