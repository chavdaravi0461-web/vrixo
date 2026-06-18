"use client";

import { useEffect } from "react";

export function HashRecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      window.location.replace("/reset-password" + hash);
    }
  }, []);

  return null;
}
