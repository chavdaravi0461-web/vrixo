"use client";

import React from "react";

export function OmegaCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`omega-card ${className}`}>{children}</div>;
}

export default OmegaCard;
