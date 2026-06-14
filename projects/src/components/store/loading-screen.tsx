"use client";

import { useEffect, useState } from "react";

export function LoadingScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"enter" | "loading" | "exit" | "gone">("enter");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setPhase("loading"));
    const t1 = setTimeout(() => setProgress(30), 100);
    const t2 = setTimeout(() => setProgress(65), 300);
    const t3 = setTimeout(() => setProgress(90), 500);
    const t4 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setPhase("exit"), 200);
    }, 800);
    const t5 = setTimeout(() => setPhase("gone"), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  return (
    <>
      {children}
      {phase !== "gone" && (
        <div className={`loading ${phase === "exit" ? "exit" : ""}`}>
          <div className="loading-symbol">Vrixo</div>
          <div className="loading-bar">
            <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
