"use client";

import { Sparkles } from "lucide-react";

export function AIFab() {
  return (
    <button
      type="button"
      className="ai-fab"
      aria-label="AI Assistant"
      onClick={() => {/* wire to AI assistant */}}
    >
      <div className="ai-fab-ring" />
      <Sparkles className="h-4 w-4" />
    </button>
  );
}
