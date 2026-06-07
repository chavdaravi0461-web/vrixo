"use client";

import { useEffect, useCallback } from "react";
import { useMotionValue, useSpring, motion } from "framer-motion";

export function CursorAmbassador() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const dotX = useSpring(cursorX, { stiffness: 300, damping: 30, mass: 0.3 });
  const dotY = useSpring(cursorY, { stiffness: 300, damping: 30, mass: 0.3 });
  const ringX = useSpring(cursorX, { stiffness: 100, damping: 20, mass: 0.5 });
  const ringY = useSpring(cursorY, { stiffness: 100, damping: 20, mass: 0.5 });
  const isVisible = useMotionValue(0);
  const visibleSpring = useSpring(isVisible, { stiffness: 200, damping: 25 });

  const handleMove = useCallback(
    (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      isVisible.set(1);
    },
    [cursorX, cursorY, isVisible],
  );

  const handleLeave = useCallback(() => {
    isVisible.set(0);
  }, [isVisible]);

  useEffect(() => {
    const isDesktop = window.matchMedia("(pointer: fine)").matches;
    if (!isDesktop) return;

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [handleMove, handleLeave]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ opacity: visibleSpring }}
    >
      <motion.div
        className="-translate-x-1/2 -translate-y-1/2"
        style={{
          x: dotX,
          y: dotY,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "oklch(0.15 0.03 264)",
          position: "absolute",
        }}
      />
      <motion.div
        className="-translate-x-1/2 -translate-y-1/2"
        style={{
          x: ringX,
          y: ringY,
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1px solid oklch(0.5 0.02 264)",
          position: "absolute",
          transition: "width 0.3s ease, height 0.3s ease, border-color 0.3s ease",
        }}
      />
    </motion.div>
  );
}
