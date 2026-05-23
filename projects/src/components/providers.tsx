"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [toastPosition, setToastPosition] = useState<"top-right" | "bottom-center">("top-right");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setToastPosition(media.matches ? "bottom-center" : "top-right");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <>
      {children}
      <Toaster
        position={toastPosition}
        richColors
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid rgba(148, 163, 184, 0.28)"
          }
        }}
      />
    </>
  );
}
