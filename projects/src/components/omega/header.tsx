"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Search, User } from "lucide-react";
import "@/styles/omega.css";

export function OmegaHeader({ title = "Vrixo Omega" }: { title?: string }) {
  return (
    <header className="omega-header">
      <div className="omega-header-left">
        <div className="omega-brand">
          <Sparkles className="omega-brand-icon" />
          <span className="omega-brand-title">{title}</span>
        </div>
        <div className="omega-search">
          <Search className="omega-search-icon" />
          <input placeholder="Search orders, products, signals..." />
        </div>
      </div>
      <div className="omega-header-right">
        <Link href="/dashboard-admin-vrixo-ravi/notifications" className="omega-header-link">Alerts</Link>
        <button className="omega-user-btn"><User /> Founder</button>
      </div>
    </header>
  );
}

export default OmegaHeader;
