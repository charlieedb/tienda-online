import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Product } from "@/lib/products";
import type { CartItem } from "@/store/cart";

const STORE_CONFIG_PATH = "config/tiendaOnlineStore";

export type DiscountCode = {
  code: string;
  percentage: 5 | 10;
  active: boolean;
};

export type AppliedDiscountCode = DiscountCode & {
  eligibleItemIds: string[];
  eligibleSubtotal: number;
  discountAmount: number;
};

export function normalizeDiscountCode(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("es-AR").replace(/\s+/g, "");
}

function normalizeCodes(value: unknown): DiscountCode[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const code = normalizeDiscountCode(item.code);
    const percentage = Number(item.percentage);
    if (!code || seen.has(code) || (percentage !== 5 && percentage !== 10)) return [];
    seen.add(code);
    return [{ code, percentage: percentage as 5 | 10, active: item.active !== false }];
  });
}

export async function getDiscountCodes(): Promise<DiscountCode[]> {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const snapshot = await getDoc(doc(db, STORE_CONFIG_PATH));
  return normalizeCodes(snapshot.data()?.discountCodes);
}

export async function saveDiscountCodes(codes: DiscountCode[], actor: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const normalized = normalizeCodes(codes);
  await setDoc(doc(db, STORE_CONFIG_PATH), {
    discountCodes: normalized,
    discountCodesUpdatedAt: serverTimestamp(),
    discountCodesUpdatedBy: actor,
  }, { merge: true });
  return normalized;
}

export function calculateDiscount(
  discountCode: DiscountCode,
  items: CartItem[],
  productsById: Map<string, Product>,
): AppliedDiscountCode {
  const eligibleItems = items.filter((item) => {
    const product = productsById.get(item.productId);
    const hasExistingDiscount = Number(item.discountPct || 0) > 0 ||
      (Number(item.listPrice || 0) > Number(item.price || 0));
    const hasPromotion = Boolean(product?.offer) || Number(product?.offerDiscount || 0) > 0;
    return !hasExistingDiscount && !hasPromotion;
  });
  const eligibleSubtotal = eligibleItems.reduce((total, item) => total + item.price * item.qty, 0);
  const discountAmount = Math.round((eligibleSubtotal * discountCode.percentage / 100 + Number.EPSILON) * 100) / 100;
  return {
    ...discountCode,
    eligibleItemIds: eligibleItems.map((item) => item.id),
    eligibleSubtotal,
    discountAmount,
  };
}

export async function validateDiscountCode(
  rawCode: string,
  items: CartItem[],
  productsById: Map<string, Product>,
) {
  const code = normalizeDiscountCode(rawCode);
  if (!code) throw new Error("Ingresá un código de descuento.");
  const match = (await getDiscountCodes()).find((item) => item.active && item.code === code);
  if (!match) throw new Error("El código no existe o ya no está activo.");
  const result = calculateDiscount(match, items, productsById);
  if (!result.eligibleItemIds.length) {
    throw new Error("Este carrito no tiene productos sin promoción para aplicar el descuento.");
  }
  return result;
}
