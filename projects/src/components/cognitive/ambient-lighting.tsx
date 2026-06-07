"use client";

import { useEffect, useRef, useCallback } from "react";

export function AmbientLighting() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const handleMouse = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouse);

    const draw = () => {
      timeRef.current += 0.005;
      const { x, y } = mouseRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const cx = x > 0 ? x : w / 2;
      const cy = y > 0 ? y : h / 2;

      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
      ambientGrad.addColorStop(0, "rgba(212, 175, 55, 0.03)");
      ambientGrad.addColorStop(0.3, "rgba(212, 175, 55, 0.015)");
      ambientGrad.addColorStop(0.6, "rgba(255, 255, 255, 0.01)");
      ambientGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, w, h);

      const breathBase = w * 0.3;
      const breathOffset = Math.sin(timeRef.current) * w * 0.05;
      const breathCx = w * 0.5 + Math.sin(timeRef.current * 0.7) * w * 0.1;
      const breathCy = h * 0.4 + Math.sin(timeRef.current * 0.5) * h * 0.05;

      const breathGrad = ctx.createRadialGradient(breathCx, breathCy, 0, breathCx, breathCy, breathBase + breathOffset);
      breathGrad.addColorStop(0, "rgba(212, 175, 55, 0.02)");
      breathGrad.addColorStop(0.5, "rgba(200, 180, 140, 0.01)");
      breathGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = breathGrad;
      ctx.fillRect(0, 0, w, h);

      const accentGrad = ctx.createRadialGradient(w * 0.15, h * 0.2, 0, w * 0.15, h * 0.2, w * 0.25);
      accentGrad.addColorStop(0, "rgba(255, 255, 255, 0.015)");
      accentGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = accentGrad;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouse]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ mixBlendMode: "overlay", zIndex: 1 }}
    />
  );
}
