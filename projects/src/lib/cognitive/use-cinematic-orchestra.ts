"use client";

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import { type Variants } from "framer-motion";

export interface CinematicScene {
  id: string;
  duration: number;
  silenceAfter?: number;
  elements: CinematicElement[];
}

interface CinematicElement {
  delay: number;
  duration: number;
}

export type CinematicTiming = "staggered" | "simultaneous" | "cascade" | "waterfall";

const STAGGER_DELAYS: Record<CinematicTiming, (i: number, total: number) => number> = {
  staggered: (i) => i * 0.08,
  simultaneous: () => 0,
  cascade: (i, t) => (i / Math.max(t - 1, 1)) * 0.6,
  waterfall: (i) => 0.15 + i * 0.04,
};

export function useCinematicOrchestra(
  count: number,
  timing: CinematicTiming = "staggered",
  baseDelay = 0.1,
) {
  const delays = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        baseDelay + STAGGER_DELAYS[timing](i, count),
      ),
    [count, timing, baseDelay],
  );

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: timing === "staggered" ? 0.08 : 0.03, delayChildren: baseDelay },
    },
  };

  const lastDelaysRef = useRef(delays);
  lastDelaysRef.current = delays;

  return {
    delays,
    containerVariants,
    getItemVariants: useCallback(
      (offset = 0): Variants => ({
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: [0.19, 1, 0.22, 1] as const, delay: offset },
        },
      }),
      [],
    ),
  };
}

export function useSilenceInterval(ms: number) {
  const [speaking, setSpeaking] = useState(true);

  useEffect(() => {
    if (ms <= 0) return;
    const timer = setTimeout(() => setSpeaking(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return { isSpeaking: speaking, isSilent: !speaking };
}

export function useNarrativeSequence(steps: number) {
  const [activeStep, setActiveStep] = useState(-1);
  const intervalRef = useRef<number | undefined>(undefined);

  const start = useCallback(
    (intervalMs = 800) => {
      setActiveStep(0);
      let i = 0;
      intervalRef.current = window.setInterval(() => {
        i++;
        if (i >= steps) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          return;
        }
        setActiveStep(i);
      }, intervalMs);
    },
    [steps],
  );

  const reset = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setActiveStep(-1);
  }, []);

  useEffect(() => () => { if (intervalRef.current) window.clearInterval(intervalRef.current); }, []);

  return { activeStep, start, reset, isComplete: activeStep >= steps - 1 };
}

export function useEntranceGate(delay = 0.3) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  const variants: Variants = {
    hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: [0.19, 1, 0.22, 1] as const },
    },
  };

  return { entered, variants };
}
