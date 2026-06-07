"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";

export interface ScrollScene {
  id: string;
  triggerStart: number;
  triggerEnd: number;
  onProgress?: (progress: number) => void;
  onEnter?: () => void;
  onExit?: () => void;
}

export function useScrollChoreography() {
  const { scrollY, scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.5 });
  const scenesRef = useRef<ScrollScene[]>([]);
  const activeScenesRef = useRef(new Set<string>());

  const registerScene = useCallback((scene: ScrollScene) => {
    scenesRef.current.push(scene);
    return () => {
      scenesRef.current = scenesRef.current.filter((s) => s.id !== scene.id);
    };
  }, []);

  useEffect(() => {
    const checkScenes = () => {
      const progress = scrollYProgress.get();
      for (const scene of scenesRef.current) {
        const wasActive = activeScenesRef.current.has(scene.id);
        const isActive = progress >= scene.triggerStart && progress <= scene.triggerEnd;

        if (isActive && !wasActive) {
          activeScenesRef.current.add(scene.id);
          scene.onEnter?.();
        }
        if (!isActive && wasActive) {
          activeScenesRef.current.delete(scene.id);
          scene.onExit?.();
        }

        if (isActive && scene.onProgress) {
          const localProgress = (progress - scene.triggerStart) / (scene.triggerEnd - scene.triggerStart);
          scene.onProgress(Math.max(0, Math.min(1, localProgress)));
        }
      }
    };

    const unsubscribe = scrollYProgress.on("change", checkScenes);
    return unsubscribe;
  }, [scrollYProgress]);

  return { scrollY, scrollYProgress, smoothProgress, registerScene };
}

export function useParallax(speed = 0.5) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (value) => value * speed);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30, mass: 0.5 });
  return { y: smoothY };
}

export function useRevealOnScroll(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasRevealed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasRevealed(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, hasRevealed]);

  return { ref, isVisible, hasRevealed };
}

export function useVelocityAwareMotion() {
  const { scrollY } = useScroll();
  const [velocity, setVelocity] = useState(0);
  const lastYRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const track = () => {
      const currentY = scrollY.get();
      const delta = currentY - lastYRef.current;
      setVelocity(Math.abs(delta));
      lastYRef.current = currentY;
      rafRef.current = requestAnimationFrame(track);
    };

    rafRef.current = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scrollY]);

  const direction = velocity > 5 ? (scrollY.get() > lastYRef.current ? "down" : "up") : "idle";
  const isScrolling = velocity > 2;

  return { velocity, isScrolling, direction };
}

export function useScrollOpacity(startOffset = 0, endOffset = 200) {
  const ref = useRef<HTMLDivElement>(null);
  const opacity = useMotionValue(1);
  const smoothOpacity = useSpring(opacity, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const scrollPos = window.scrollY;
      const elTop = rect.top + scrollPos;
      const progress = (scrollPos - elTop + startOffset) / (endOffset - startOffset);
      opacity.set(Math.max(0, Math.min(1, 1 - progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [startOffset, endOffset, opacity]);

  return { ref, opacity: smoothOpacity };
}
