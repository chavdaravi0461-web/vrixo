"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHRASES = [
  "Crafted for the discerning",
  "Where luxury meets precision",
  "Experience the extraordinary",
];

export function EmotionalOnboarding() {
  const [phase, setPhase] = useState<"enter" | "shown" | "exit">("enter");
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem("vrixo-welcomed");
    if (seen) {
      setHasSeen(true);
      return;
    }
    setHasSeen(false);

    const t1 = setTimeout(() => setPhase("shown"), 200);
    const t2 = setTimeout(() => setPhase("exit"), 2800);
    const t3 = setTimeout(() => {
      setPhase("enter");
      sessionStorage.setItem("vrixo-welcomed", "1");
      setHasSeen(true);
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (hasSeen) return null;

  return (
    <AnimatePresence>
      {phase !== "enter" && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{ background: "oklch(0.99 0.002 85)" }}
        >
          <div className="text-center">
            <motion.p
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={
                phase === "shown"
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: -12, filter: "blur(4px)" }
              }
              transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
              className="lp-heading-1"
              style={{ color: "var(--lp-text-secondary)" }}
            >
              {PHRASES[0]}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={
                phase === "shown"
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: -8, filter: "blur(3px)" }
              }
              transition={{ duration: 1.0, delay: 0.6, ease: [0.19, 1, 0.22, 1] }}
              className="lp-body-sm mt-4"
            >
              VRIXO
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={
                phase === "shown"
                  ? { scaleX: 1 }
                  : { scaleX: 0 }
              }
              transition={{ duration: 1.4, delay: 1.2, ease: [0.19, 1, 0.22, 1] }}
              className="mx-auto mt-8 h-px origin-left"
              style={{ width: 120, background: "var(--lp-accent)" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
