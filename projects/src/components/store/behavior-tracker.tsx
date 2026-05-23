"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "vrixo_session_id";

export function BehaviorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = getSessionId();
    const path = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

    const sent = navigator.sendBeacon?.(
      "/api/behavior/events",
      new Blob([JSON.stringify({ sessionId, eventType: "page_view", path })], { type: "application/json" })
    );

    if (!sent) {
      fetch("/api/behavior/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, eventType: "page_view", path }),
        keepalive: true
      }).catch(() => undefined);
    }
  }, [pathname, searchParams]);

  return null;
}

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}
