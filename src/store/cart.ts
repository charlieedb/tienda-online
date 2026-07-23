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
  listPrice?: number;
  discountPct?: number;
  unitPriceFinal?: number;
  unitsPerPack?: number;
  stockLimit?: number;
  qty: number;
};

export function getCartItemUnits(item: Pick<CartItem, "variant" | "unitsPerPack" | "qty">) {
  const unitsPerItem = item.variant === "pack" ? Math.max(1, Math.trunc(Number(item.unitsPerPack) || 1)) : 1;
  return Math.max(0, Math.trunc(Number(item.qty) || 0)) * unitsPerItem;
}

export function getRemainingStock(items: CartItem[], productId: string, stockLimit?: number) {
  if (stockLimit === undefined || !Number.isFinite(stockLimit)) return undefined;
  const reserved = items
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + getCartItemUnits(item), 0);
  return Math.max(0, Math.floor(stockLimit) - reserved);
}

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
          const requestedQty = Math.max(0, Math.trunc(Number(qty) || 0));
          if (!requestedQty) return {};
          const unitsPerItem = item.variant === "pack" ? Math.max(1, Math.trunc(Number(item.unitsPerPack) || 1)) : 1;
          const remaining = getRemainingStock(state.items, item.productId, item.stockLimit);
          const allowedQty = remaining === undefined ? requestedQty : Math.min(requestedQty, Math.floor(remaining / unitsPerItem));
          if (!allowedQty) return {};
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, ...item, qty: i.qty + allowedQty } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty: allowedQty }] };
        }),
      setItemQty: (id, qty) =>
        set((state) => {
          const nextQty = Math.max(0, Math.min(999, Math.trunc(qty)));
          if (nextQty === 0) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          const existing = state.items.find((i) => i.id === id);
          if (!existing) return {};
          const unitsPerItem = existing.variant === "pack" ? Math.max(1, Math.trunc(Number(existing.unitsPerPack) || 1)) : 1;
          const otherReserved = state.items
            .filter((i) => i.productId === existing.productId && i.id !== id)
            .reduce((total, i) => total + getCartItemUnits(i), 0);
          const maxQty = existing.stockLimit === undefined || !Number.isFinite(existing.stockLimit)
            ? 999
            : Math.max(existing.qty, Math.floor((Math.max(0, Math.floor(existing.stockLimit) - otherReserved)) / unitsPerItem));
          const boundedQty = nextQty > existing.qty ? Math.min(nextQty, maxQty) : nextQty;
          return { items: state.items.map((i) => (i.id === id ? { ...i, qty: boundedQty } : i)) };
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
