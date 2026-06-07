"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  restSpeed?: number;
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 300, damping: 25, mass: 0.5 };

export function useSpringPhysics(config: SpringConfig = DEFAULT_SPRING) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: config.stiffness ?? 300,
    damping: config.damping ?? 25,
    mass: config.mass ?? 0.5,
    restSpeed: config.restSpeed ?? 0.5,
  });

  const setValue = useCallback(
    (value: number) => { motionValue.set(value); },
    [motionValue],
  );

  return { motionValue, springValue, setValue };
}

export function useSpringPosition() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const setPosition = useCallback(
    (px: number, py: number) => {
      x.set(px);
      y.set(py);
    },
    [x, y],
  );

  return { x, y, springX, springY, setPosition };
}

export function useCursorMagnetism(radius = 120, strength = 0.15) {
  const [magnetized, setMagnetized] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const { springX, springY, setPosition } = useSpringPosition();

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        setMagnetized(true);
        const pull = (1 - dist / radius) * strength;
        offsetRef.current = { x: dx * pull, y: dy * pull };
        setPosition(dx * pull, dy * pull);
      } else {
        setMagnetized(false);
        setPosition(0, 0);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [radius, strength, setPosition]);

  return {
    elementRef,
    isMagnetized: magnetized,
    magnetOffset: { x: springX as MotionValue<number>, y: springY as MotionValue<number> },
  };
}

export function useSpringScale(base = 1, hover = 1.04, tap = 0.97) {
  const [state, setState] = useState<"idle" | "hover" | "tap">("idle");
  const scaleMotion = useMotionValue(base);
  const scaleSpring = useSpring(scaleMotion, { stiffness: 400, damping: 20, mass: 0.3 });

  const targetMap = { idle: base, hover, tap };

  const handleHoverStart = useCallback(() => {
    setState("hover");
    scaleMotion.set(targetMap.hover);
  }, [scaleMotion, hover, base]);

  const handleHoverEnd = useCallback(() => {
    setState("idle");
    scaleMotion.set(targetMap.idle);
  }, [scaleMotion, base]);

  const handleTapStart = useCallback(() => {
    setState("tap");
    scaleMotion.set(targetMap.tap);
  }, [scaleMotion, tap, base]);

  const handleTapEnd = useCallback(() => {
    setState("idle");
    scaleMotion.set(targetMap.idle);
  }, [scaleMotion, base]);

  return { scaleSpring, handleHoverStart, handleHoverEnd, handleTapStart, handleTapEnd, state };
}
