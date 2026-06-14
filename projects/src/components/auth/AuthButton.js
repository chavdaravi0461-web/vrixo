"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export function AuthButton() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  if (isLoading) {
    return (
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          animation: "pulse 2s infinite",
        }}
      />
    );
  }

  if (session?.user) {
    return (
      <Link
        href="/account"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          textDecoration: "none",
          padding: "4px",
          borderRadius: "24px",
          border: "1px solid transparent",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || "Profile"}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--border)",
            }}
          />
        ) : (
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--bg-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {(session.user.name || "U").charAt(0).toUpperCase()}
          </div>
        )}
      </Link>
    );
  }

  return (
      <Link
        href="/login"
      style={{
        padding: "8px 20px",
        borderRadius: "8px",
        background: "var(--accent)",
        color: "var(--bg-primary)",
        fontSize: "14px",
        fontWeight: 600,
        textDecoration: "none",
        transition: "opacity 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      Sign in
    </Link>
  );
}
