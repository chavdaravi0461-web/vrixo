"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type WishlistState = {
  ids: string[];
  toggle: (id: string) => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({
          ids: get().ids.includes(id)
            ? get().ids.filter((entry) => entry !== id)
            : [...get().ids, id]
        })
    }),
    {
      name: "vrixo-wishlist",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
