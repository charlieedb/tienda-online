"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CART_STORAGE_KEY = "listita_cart_v1";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  variant: "unit" | "pack";
  label: string;
  price: number;
  unitPriceFinal?: number;
  unitsPerPack?: number;
  qty: number;
};

type CartState = {
  open: boolean;
  items: CartItem[];
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setItemQty: (id: string, qty: number) => void;
  decItem: (id: string) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  resetSession: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      open: false,
      items: [],
      openCart: () => set({ open: true }),
      closeCart: () => set({ open: false }),
      toggleCart: () => set({ open: !get().open }),
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),
      setItemQty: (id, qty) =>
        set((state) => {
          const nextQty = Math.max(0, Math.min(999, Math.trunc(qty)));
          if (nextQty === 0) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) => (i.id === id ? { ...i, qty: nextQty } : i)),
          };
        }),
      decItem: (id) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (!existing) return {};
          if (existing.qty <= 1) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, qty: i.qty - 1 } : i,
            ),
          };
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
      resetSession: () => set({ open: false, items: [] }),
    }),
    { name: CART_STORAGE_KEY },
  ),
);

export function clearPersistedCart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignore privacy / storage errors.
  }
}
