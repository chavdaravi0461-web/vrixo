"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type RecentlyViewedState = {
  slugs: string[];
  add: (slug: string) => void;
};

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      slugs: [],
      add: (slug) =>
        set({
          slugs: [
            slug,
            ...get().slugs.filter((s) => s !== slug),
          ].slice(0, 20),
        }),
    }),
    {
      name: "vrixo-recently-viewed",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
