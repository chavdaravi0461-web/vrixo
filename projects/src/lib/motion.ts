import type { Variants, Transition } from "framer-motion";

// ─── Signature Easing ───
export const ease = [0.19, 1, 0.22, 1] as const;
export const easeOut = [0, 0, 0.2, 1] as const;
export const easeIn = [0.4, 0, 1, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;
export const easeEmphasized = [0.2, 0, 0, 1] as const;
export const easeMagnetic = [0.34, 1.56, 0.64, 1] as const;

// ─── Spring Physics ───
export const springGentle = { type: "spring" as const, stiffness: 120, damping: 14, mass: 0.8 };
export const springSnappy = { type: "spring" as const, stiffness: 300, damping: 20, mass: 0.5 };
export const springLift = { type: "spring" as const, stiffness: 250, damping: 15, mass: 0.6 };
export const springFloat = { type: "spring" as const, stiffness: 80, damping: 10, mass: 1 };

// ─── Transition Presets ───
export const transitionFast: Transition = { duration: 0.25, ease: easeOut };
export const transitionSmooth: Transition = { duration: 0.5, ease };
export const transitionSlow: Transition = { duration: 0.8, ease };
export const transitionCinematic: Transition = { duration: 1.4, ease: easeEmphasized };

// ─── Reveal Variants ───
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionSmooth },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: transitionSlow },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.92, filter: "blur(10px)" },
  visible: { opacity: 1, scale: 1, filter: "blur(0px)", transition: transitionCinematic },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -80, filter: "blur(6px)" },
  visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: transitionSlow },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 80, filter: "blur(6px)" },
  visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: transitionSlow },
};

export const clipReveal: Variants = {
  hidden: { clipPath: "inset(0 100% 0 0)" },
  visible: { clipPath: "inset(0 0% 0 0)", transition: { duration: 1.0, ease } },
};

export const scaleReveal: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.8, ease } },
};

// ─── Stagger System ───
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2, ease },
  },
};

export const staggerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3, ease },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 32, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};

export const staggerItemFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease } },
};

// ─── Card Interactions ───
export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -8, scale: 1.01, transition: springLift },
  tap: { y: -2, scale: 0.98, transition: springSnappy },
};

export const imageZoom = {
  rest: { scale: 1 },
  hover: { scale: 1.08, transition: { duration: 0.6, ease } },
};

export const imageReveal = {
  hidden: { scale: 1.15, filter: "blur(12px)" },
  visible: { scale: 1, filter: "blur(0px)", transition: { duration: 1.2, ease: easeEmphasized } },
};

export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: springSnappy },
  tap: { scale: 0.97, transition: springSnappy },
};

// ─── Glass & Depth ───
export const glassReveal: Variants = {
  hidden: { opacity: 0, y: 48, backdropFilter: "blur(0px)", filter: "blur(10px)" },
  visible: {
    opacity: 1, y: 0,
    backdropFilter: "blur(20px)", filter: "blur(0px)",
    transition: { duration: 1.0, ease },
  },
};

export const depthLift: Variants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease } },
};

// ─── Magnetic (cursor follow) ───
export const magneticHover = {
  rest: { x: 0, y: 0 },
  hover: { x: 0, y: 0, transition: springSnappy },
};

// ─── Page transition ───
export const pageEnter: Variants = {
  hidden: { opacity: 0, filter: "blur(4px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease } },
};

export const pageExit: Variants = {
  hidden: { opacity: 0, filter: "blur(4px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.3, ease } },
};

// ─── Counter / number ───
export const countUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

// ─── Line reveal (for text) ───
export const lineReveal: Variants = {
  hidden: { y: "100%" },
  visible: { y: "0%", transition: { duration: 0.7, ease } },
};

export const lineParent: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
