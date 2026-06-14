"use client";

import React from "react";
import Link from "next/link";

export function StatusCard({ href, icon: Icon, label, value, sub, tone = "default" }: { href?: string; icon?: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone?: string; }) {
  const content = (
    <div className={`omega-status-card omega-status-${tone}`}>
      <div className="omega-status-left">
        {Icon ? <Icon className="omega-status-icon" /> : null}
        <div>
          <div className="omega-status-label">{label}</div>
          <div className="omega-status-value">{value}</div>
        </div>
      </div>
      {sub ? <div className="omega-status-sub">{sub}</div> : null}
    </div>
  );

  if (href) return <Link href={href} className="omega-status-link">{content}</Link>;
  return content;
}

export default StatusCard;
