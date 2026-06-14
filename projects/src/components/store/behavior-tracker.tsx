"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "vrixo_session_id";

function sendEvent(payload: Record<string, unknown>) {
  const sent = navigator.sendBeacon?.(
    "/api/behavior/events",
    new Blob([JSON.stringify(payload)], { type: "application/json" })
  );
  if (!sent) {
    fetch("/api/behavior/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), keepalive: true
    }).catch(() => undefined);
  }
}

export function BehaviorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useReportWebVitals((metric) => {
    sendEvent({
      sessionId: getSessionId(),
      eventType: "web_vital",
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: pathname,
    });
  });

  useEffect(() => {
    const sessionId = getSessionId();
    const path = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

    sendEvent({ sessionId, eventType: "page_view", path });
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
