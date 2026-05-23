"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/types/index";

type CartState = {
  items: CartItem[];
  couponCode: string;
  discount: number;
  hasHydrated: boolean;
  addItem: (item: CartItem) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string
  ) => void;
  removeItem: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  clearCart: () => void;
  setCoupon: (code: string, discount: number) => void;
  setHasHydrated: (value: boolean) => void;
};

function matchesCartItem(
  entry: CartItem,
  productId: string,
  selectedSize?: string,
  selectedColor?: string
) {
  return (
    entry.productId === productId &&
    entry.selectedSize === selectedSize &&
    entry.selectedColor === selectedColor
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: "",
      discount: 0,
      hasHydrated: false,
      addItem: (item) =>
        set((state) => {
          if (item.stock <= 0) {
            return state;
          }

          const existing = state.items.find(
            (entry) =>
              matchesCartItem(
                entry,
                item.productId,
                item.selectedSize,
                item.selectedColor
              )
          );

          if (existing) {
            return {
              items: state.items.map((entry) =>
                matchesCartItem(
                  entry,
                  item.productId,
                  item.selectedSize,
                  item.selectedColor
                )
                  ? {
                      ...entry,
                      quantity: Math.min(entry.quantity + item.quantity, entry.stock)
                    }
                  : entry
              )
            };
          }

          return { items: [...state.items, item] };
        }),
      updateQuantity: (productId, quantity, selectedSize, selectedColor) =>
        set((state) => ({
          items: state.items.map((entry) =>
            matchesCartItem(entry, productId, selectedSize, selectedColor)
              ? { ...entry, quantity: Math.max(1, Math.min(quantity, entry.stock)) }
              : entry
          )
        })),
      removeItem: (productId, selectedSize, selectedColor) =>
        set((state) => ({
          items: state.items.filter(
            (entry) => !matchesCartItem(entry, productId, selectedSize, selectedColor)
          )
        })),
      clearCart: () =>
        set({
          items: [],
          couponCode: "",
          discount: 0
        }),
      setCoupon: (couponCode, discount) => set({ couponCode, discount }),
      setHasHydrated: (value) => set({ hasHydrated: value })
    }),
    {
      name: "vrixo-cart",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
