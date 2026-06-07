"use client";

import dynamic from "next/dynamic";

const AmbientLighting = dynamic(
  () => import("@/components/cognitive/ambient-lighting").then((m) => m.AmbientLighting),
  { ssr: false },
);

export function LightingWrapper() {
  return <AmbientLighting />;
}
