"use client";

import React from "react";

export function OmegaModal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="omega-modal-backdrop" onClick={onClose}>
      <div className="omega-modal" onClick={(e) => e.stopPropagation()}>
        <button className="omega-modal-close" onClick={onClose}>✕</button>
        <div className="omega-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default OmegaModal;
