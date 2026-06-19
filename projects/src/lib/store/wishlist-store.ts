"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

function getSafeStorage(): Storage {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch { /* fall through */ }
  let store: Record<string, string> = {};
  return {
    getItem: (name) => store[name] ?? null,
    setItem: (name, value) => { store[name] = value; },
    removeItem: (name) => { delete store[name]; },
    get length() { return Object.keys(store).length; },
    clear: () => { store = {}; },
    key: (index) => Object.keys(store)[index] ?? null,
  };
}

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
      storage: createJSONStorage(() => getSafeStorage())
    }
  )
);
