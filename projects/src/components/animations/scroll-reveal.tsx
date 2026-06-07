"use client";

import { motion, type MotionProps } from "framer-motion";
import { useRef } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

interface ScrollRevealProps extends MotionProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  amount?: number | "some" | "all";
}

const ease = [0.19, 1, 0.22, 1] as const;

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.9,
  distance = 48,
  className,
  once = true,
  amount = 0.15,
  ...motionProps
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  const offsets: Record<Direction, { x?: number; y?: number }> = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };
  const offset = offsets[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...offset, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount }}
      transition={{ delay, duration, ease }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
