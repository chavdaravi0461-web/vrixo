"use client";

import { useEffect, useState } from "react";

export function VrixoSplash({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit" | "gone">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 60);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(() => setPhase("gone"), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <>
      {children}
      {phase !== "gone" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0908",
            transition: "opacity 0.8s ease, transform 0.8s ease",
            opacity: phase === "exit" ? 0 : 1,
            transform: phase === "exit" ? "scale(1.08)" : "scale(1)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              opacity: phase === "enter" ? 0 : 1,
              transform: phase === "enter" ? "translateY(20px)" : "translateY(0)",
              transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
            }}
          >
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "clamp(52px, 10vw, 100px)",
                fontWeight: 400,
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Vrixo
            </span>
            <div
              style={{
                width: 0,
                height: "1px",
                margin: "24px auto 0",
                background: "linear-gradient(90deg, transparent, rgba(184,137,66,0.4), transparent)",
                animation: phase === "show" ? "dcSplashLine 1s ease forwards" : "none",
              }}
            />
            <p
              style={{
                marginTop: 18,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "4px",
                color: "rgba(184,137,66,0.5)",
                textTransform: "uppercase",
                opacity: phase === "enter" ? 0 : 1,
                transition: "opacity 0.6s ease 0.4s",
              }}
            >
              Premium Shoes &amp; Watches
            </p>
          </div>
        </div>
      )}
    </>
  );
}
