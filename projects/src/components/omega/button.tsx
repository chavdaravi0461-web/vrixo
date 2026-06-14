"use client";

import React from "react";
import { type LucideIcon } from "lucide-react";

export function OmegaButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button className="omega-btn" onClick={onClick}>
      {children}
    </button>
  );
}

export function OmegaIconButton({ icon: Icon, onClick }: { icon: LucideIcon; onClick?: () => void }) {
  return (
    <button className="omega-icon-btn" onClick={onClick}>
      <Icon />
    </button>
  );
}

export default OmegaButton;
