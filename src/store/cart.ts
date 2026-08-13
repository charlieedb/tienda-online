"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CART_STORAGE_KEY = "listita_cart_v1";
export const CART_DURATION_MS = 10 * 60 * 1000;

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
  promoPackQty?: number;
  promoPackUnitPrice?: number;
  offerMinQty?: number;
  offerUnitPrice?: number;
  offerAllowCoupons?: boolean;
  offerMaxUnits?: number;
  offerUsedUnits?: number;
  qty: number;
};

export function getCartItemPricing(item: CartItem) {
  const qty = Math.max(0, Math.trunc(Number(item.qty) || 0));
  const unitsPerItem = item.variant === "pack" ? Math.max(1, Math.trunc(Number(item.unitsPerPack) || 1)) : 1;
  const totalUnits = qty * unitsPerItem;
  const itemPrice = Math.max(0, Number(item.price) || 0);
  const listItemPrice = Math.max(itemPrice, Number(item.listPrice) || 0);
  const regularUnitPrice = listItemPrice / unitsPerItem;
  const listTotal = listItemPrice * qty;
  const configuredOfferUnits = Math.max(0, Math.trunc(Number(item.offerMaxUnits) || 0));
  const usedOfferUnits = Math.max(0, Math.trunc(Number(item.offerUsedUnits) || 0));
  const maxOfferUnits = configuredOfferUnits > 0 ? Math.max(0, configuredOfferUnits - usedOfferUnits) : 0;
  const capOfferUnits = (units: number) => configuredOfferUnits > 0 ? Math.min(units, maxOfferUnits) : units;
  const offerMinQty = Math.max(2, Math.trunc(Number(item.offerMinQty) || 0));
  const offerUnitPrice = Number(item.offerUnitPrice);
  if (Number.isFinite(offerUnitPrice) && offerUnitPrice > 0 && totalUnits >= offerMinQty) {
    const promoUnits = capOfferUnits(totalUnits);
    const regularUnits = totalUnits - promoUnits;
    const promoSubtotal = offerUnitPrice * promoUnits;
    const regularSubtotal = regularUnitPrice * regularUnits;
    return { listTotal, total: promoSubtotal + regularSubtotal, promoUnits, regularUnits, promoSubtotal, regularSubtotal };
  }
  const packQty = Math.max(1, Math.trunc(Number(item.promoPackQty) || 0));
  const promoUnitPrice = Number(item.promoPackUnitPrice);
  if (Number.isFinite(promoUnitPrice) && promoUnitPrice > 0 && packQty > 1) {
    const eligibleUnits = Math.floor(capOfferUnits(totalUnits) / packQty) * packQty;
    const promoUnits = Math.min(totalUnits, eligibleUnits);
    const regularUnits = totalUnits - promoUnits;
    const promoSubtotal = promoUnits * promoUnitPrice;
    const regularSubtotal = regularUnits * regularUnitPrice;
    return { listTotal, total: promoSubtotal + regularSubtotal, promoUnits, regularUnits, promoSubtotal, regularSubtotal };
  }
  const hasDirectOffer = listItemPrice > itemPrice;
  if (hasDirectOffer) {
    const eligibleItems = configuredOfferUnits > 0 ? Math.floor(maxOfferUnits / unitsPerItem) : qty;
    const promoItems = Math.min(qty, eligibleItems);
    const promoUnits = promoItems * unitsPerItem;
    const regularUnits = totalUnits - promoUnits;
    const promoSubtotal = promoItems * itemPrice;
    const regularSubtotal = (qty - promoItems) * listItemPrice;
    return { listTotal, total: promoSubtotal + regularSubtotal, promoUnits, regularUnits, promoSubtotal, regularSubtotal };
  }
  return { listTotal, total: listTotal, promoUnits: 0, regularUnits: totalUnits, promoSubtotal: 0, regularSubtotal: listTotal };
}

export function getCartPricingMap(items: CartItem[]) {
  const allocatedByProduct = new Map<string, number>();
  return new Map(items.map((item) => {
    const allocated = allocatedByProduct.get(item.productId) || 0;
    const pricing = getCartItemPricing({
      ...item,
      offerUsedUnits: Math.max(0, Number(item.offerUsedUnits) || 0) + allocated,
    });
    if (Number(item.offerMaxUnits || 0) > 0) {
      allocatedByProduct.set(item.productId, allocated + pricing.promoUnits);
    }
    return [item.id, pricing] as const;
  }));
}

export type CartDiscountCode = {
  code: string;
  percentage: number;
  active: boolean;
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  usageCount: number;
  eligibleItemIds: string[];
  eligibleSubtotalByItem: Record<string, number>;
  eligibleSubtotal: number;
  discountAmount: number;
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
  appliedDiscountCode: CartDiscountCode | null;
  expiresAt: number | null;
  dailyOfferUsage: Record<string, number>;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setItemQty: (id: string, qty: number) => void;
  decItem: (id: string) => void;
  removeItem: (id: string) => void;
  setAppliedDiscountCode: (discountCode: CartDiscountCode | null) => void;
  clear: () => void;
  extendExpiry: () => void;
  resetSession: () => void;
  setDailyOfferUsage: (usage: Record<string, number>) => void;
};

function nextExpiry(previousItems: CartItem[], nextItems: CartItem[], currentExpiry: number | null) {
  if (!nextItems.length) return null;
  if (!previousItems.length || !currentExpiry) return Date.now() + CART_DURATION_MS;
  return currentExpiry;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      open: false,
      items: [],
      appliedDiscountCode: null,
      expiresAt: null,
      dailyOfferUsage: {},
      openCart: () => set({ open: true }),
      closeCart: () => set({ open: false }),
      toggleCart: () => set({ open: !get().open }),
      addItem: (item, qty = 1) =>
        set((state) => {
          item = {
            ...item,
            offerUsedUnits: Math.max(0, Math.trunc(Number(state.dailyOfferUsage[item.productId]) || 0)),
          };
          const existing = state.items.find((i) => i.id === item.id);
          const requestedQty = Math.max(0, Math.trunc(Number(qty) || 0));
          if (!requestedQty) return {};
          const unitsPerItem = item.variant === "pack" ? Math.max(1, Math.trunc(Number(item.unitsPerPack) || 1)) : 1;
          const remaining = getRemainingStock(state.items, item.productId, item.stockLimit);
          const allowedQty = remaining === undefined ? requestedQty : Math.min(requestedQty, Math.floor(remaining / unitsPerItem));
          if (!allowedQty) return {};
          if (existing) {
            const items = state.items.map((i) =>
              i.id === item.id ? { ...i, ...item, qty: i.qty + allowedQty } : i,
            );
            return {
              items,
              expiresAt: nextExpiry(state.items, items, state.expiresAt),
              appliedDiscountCode: items.length ? state.appliedDiscountCode : null,
            };
          }
          const items = [...state.items, { ...item, qty: allowedQty }];
          return {
            items,
            expiresAt: nextExpiry(state.items, items, state.expiresAt),
          };
        }),
      setItemQty: (id, qty) =>
        set((state) => {
          const nextQty = Math.max(0, Math.min(999, Math.trunc(qty)));
          if (nextQty === 0) {
            const items = state.items.filter((i) => i.id !== id);
            return {
              items,
              expiresAt: nextExpiry(state.items, items, state.expiresAt),
              appliedDiscountCode: items.length ? state.appliedDiscountCode : null,
            };
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
          const items = state.items.map((i) => (i.id === id ? { ...i, qty: boundedQty } : i));
          return {
            items,
            expiresAt: nextExpiry(state.items, items, state.expiresAt),
          };
        }),
      decItem: (id) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (!existing) return {};
          if (existing.qty <= 1) {
            const items = state.items.filter((i) => i.id !== id);
            return {
              items,
              expiresAt: nextExpiry(state.items, items, state.expiresAt),
              appliedDiscountCode: items.length ? state.appliedDiscountCode : null,
            };
          }
          const items = state.items.map((i) =>
            i.id === id ? { ...i, qty: i.qty - 1 } : i,
          );
          return {
            items,
            expiresAt: nextExpiry(state.items, items, state.expiresAt),
          };
        }),
      removeItem: (id) =>
        set((state) => {
          const items = state.items.filter((i) => i.id !== id);
          return {
            items,
            expiresAt: nextExpiry(state.items, items, state.expiresAt),
            appliedDiscountCode: items.length ? state.appliedDiscountCode : null,
          };
        }),
      setAppliedDiscountCode: (appliedDiscountCode) => set({ appliedDiscountCode }),
      clear: () => set({ items: [], expiresAt: null, appliedDiscountCode: null }),
      extendExpiry: () =>
        set((state) => ({
          expiresAt: state.items.length ? Date.now() + CART_DURATION_MS : null,
        })),
      resetSession: () => set({ open: false, items: [], expiresAt: null, appliedDiscountCode: null }),
      setDailyOfferUsage: (usage) => set((state) => ({
        dailyOfferUsage: usage,
        items: state.items.map((item) => ({
          ...item,
          offerUsedUnits: Math.max(0, Math.trunc(Number(usage[item.productId]) || 0)),
        })),
      })),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as Partial<CartState>;
        const items = Array.isArray(state.items) ? state.items : [];
        return {
          ...state,
          items,
          appliedDiscountCode: items.length && state.appliedDiscountCode
            ? {
                ...state.appliedDiscountCode,
                eligibleSubtotalByItem: state.appliedDiscountCode.eligibleSubtotalByItem ?? {},
              }
            : null,
          expiresAt: items.length ? Date.now() + CART_DURATION_MS : null,
        } as CartState;
      },
    },
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
