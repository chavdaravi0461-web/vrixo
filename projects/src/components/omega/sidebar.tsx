"use client";

import React from "react";
import Link from "next/link";
import { Box, Truck, ShoppingCart, BarChart3, Users } from "lucide-react";

export function OmegaSidebar({ current }: { current?: string }) {
  const items = [
    { href: "/dashboard-admin-vrixo-ravi", label: "Command", icon: Box },
    { href: "/dashboard-admin-vrixo-ravi/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard-admin-vrixo-ravi/products", label: "Catalog", icon: ShoppingCart },
    { href: "/dashboard-admin-vrixo-ravi/shipping", label: "Logistics", icon: Truck },
    { href: "/dashboard-admin-vrixo-ravi/users", label: "People", icon: Users },
  ];

  return (
    <nav className="omega-sidebar">
      {items.map((it) => {
        const Icon = it.icon;
        const active = current === it.href;
        return (
          <Link key={it.href} href={it.href} className={`omega-sidebar-link ${active ? "active" : ""}`}>
            <Icon className="omega-sidebar-icon" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default OmegaSidebar;
