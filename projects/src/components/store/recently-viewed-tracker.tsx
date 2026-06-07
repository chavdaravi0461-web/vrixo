"use client";

import { useEffect } from "react";
import { useRecentlyViewedStore } from "@/lib/store/recently-viewed-store";

export function RecentlyViewedTracker({ slug }: { slug: string }) {
  const add = useRecentlyViewedStore((s) => s.add);

  useEffect(() => {
    add(slug);
  }, [slug, add]);

  return null;
}
