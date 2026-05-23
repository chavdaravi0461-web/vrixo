"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global.error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Segoe UI, sans-serif", background: "#fbf7f0" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px"
          }}
        >
          <section
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#fff",
              borderRadius: "24px",
              padding: "28px",
              textAlign: "center",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
            }}
          >
            <h1 style={{ margin: 0, fontSize: "28px" }}>VRIXO is recovering</h1>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              A temporary application error occurred. Your cart and account data remain safe.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "12px 18px",
                  background: "#0f766e",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Try again
              </button>
              <a
                href="/home"
                style={{
                  borderRadius: "999px",
                  padding: "12px 18px",
                  border: "1px solid #cbd5e1",
                  color: "#0f172a",
                  textDecoration: "none"
                }}
              >
                Go home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
