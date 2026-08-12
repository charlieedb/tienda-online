import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { refreshUserProfile } from "@/lib/userProfile";
import type { Product } from "@/lib/products";
import { getCartItemPricing, type CartItem } from "@/store/cart";

const STORE_CONFIG_PATH = "config/tiendaOnlineStore";

export type DiscountCode = {
  code: string;
  percentage: number;
  active: boolean;
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  usageCount: number;
  audience?: "all" | "business";
  perUserLimit?: number;
  source?: "manual" | "notification";
  campaignId?: string;
};

export type DiscountCodeUsage = {
  id: string;
  code: string;
  orderId: string;
  usedAtIso: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  percentage: number;
  discountAmount: number;
};

export type AppliedDiscountCode = DiscountCode & {
  eligibleItemIds: string[];
  eligibleSubtotalByItem: Record<string, number>;
  eligibleSubtotal: number;
  discountAmount: number;
};

export function normalizeDiscountCode(value: unknown) {
  return String(value ?? "").trim().toLocaleUpperCase("es-AR").replace(/\s+/g, "");
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeCodes(value: unknown): DiscountCode[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const code = normalizeDiscountCode(item.code);
    const percentage = Number(item.percentage);
    if (!code || seen.has(code) || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return [];
    seen.add(code);
    return [{
      code,
      percentage: Math.round(percentage * 100) / 100,
      active: item.active !== false,
      validFrom: normalizeDate(item.validFrom),
      validUntil: normalizeDate(item.validUntil),
      usageLimit: Math.max(0, Math.trunc(Number(item.usageLimit) || 0)),
      usageCount: Math.max(0, Math.trunc(Number(item.usageCount) || 0)),
      audience: item.audience === "business" ? "business" : "all",
      perUserLimit: Math.max(0, Math.trunc(Number(item.perUserLimit) || 0)),
      source: item.source === "notification" ? "notification" : "manual",
      campaignId: String(item.campaignId ?? "").trim(),
    }];
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
  const configRef = doc(db, STORE_CONFIG_PATH);
  let saved = normalized;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(configRef);
    const current = normalizeCodes(snapshot.data()?.discountCodes);
    const usageByCode = new Map(current.map((item) => [item.code, item.usageCount]));
    saved = normalized.map((item) => ({
      ...item,
      usageCount: Math.max(item.usageCount, usageByCode.get(item.code) || 0),
    }));
    transaction.set(configRef, {
      discountCodes: saved,
      discountCodesUpdatedAt: serverTimestamp(),
      discountCodesUpdatedBy: actor,
    }, { merge: true });
  });
  return saved;
}

export async function getDiscountCodeUsages(maxResults = 500): Promise<DiscountCodeUsage[]> {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const snapshot = await getDocs(query(
    collection(db, "discountCodeUsages"),
    orderBy("usedAtIso", "desc"),
    limit(Math.max(1, Math.min(1000, Math.trunc(maxResults)))),
  ));
  return snapshot.docs.map((usage) => {
    const item = usage.data() as Record<string, unknown>;
    return {
      id: usage.id,
      code: normalizeDiscountCode(item.code),
      orderId: String(item.orderId ?? usage.id),
      usedAtIso: String(item.usedAtIso ?? ""),
      customerUid: String(item.customerUid ?? ""),
      customerName: String(item.customerName ?? ""),
      customerEmail: String(item.customerEmail ?? ""),
      customerPhone: String(item.customerPhone ?? ""),
      percentage: Number(item.percentage) || 0,
      discountAmount: Number(item.discountAmount) || 0,
    };
  });
}

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function calculateDiscount(
  discountCode: DiscountCode,
  items: CartItem[],
  productsById: Map<string, Product>,
): AppliedDiscountCode {
  const eligibleSubtotalByItem: Record<string, number> = Object.fromEntries(items.flatMap((item) => {
    const product = productsById.get(item.productId);
    const pricing = getCartItemPricing(item);
    if (pricing.promoUnits > 0) {
      const looseSubtotal = pricing.regularUnits * Math.max(0, Number(item.price) || 0);
      return looseSubtotal > 0 ? [[item.id, looseSubtotal]] : [];
    }
    const hasExistingDiscount = Number(item.discountPct || 0) > 0 ||
      (Number(item.listPrice || 0) > Number(item.price || 0));
    const hasPromotion = Boolean(product?.offer) || Number(product?.offerDiscount || 0) > 0;
    return !hasExistingDiscount && !hasPromotion && pricing.total > 0 ? [[item.id, pricing.total]] : [];
  }));
  const eligibleItemIds = Object.keys(eligibleSubtotalByItem);
  const eligibleSubtotal = Object.values(eligibleSubtotalByItem).reduce((total, subtotal) => total + subtotal, 0);
  const discountAmount = Math.round((eligibleSubtotal * discountCode.percentage / 100 + Number.EPSILON) * 100) / 100;
  return {
    ...discountCode,
    eligibleItemIds,
    eligibleSubtotalByItem,
    eligibleSubtotal,
    discountAmount,
  };
}

export async function validateDiscountCode(
  rawCode: string,
  items: CartItem[],
  productsById: Map<string, Product>,
  customerUid?: string,
) {
  const code = normalizeDiscountCode(rawCode);
  if (!code) throw new Error("Ingresá un código de descuento.");
  const match = (await getDiscountCodes()).find((item) => item.active && item.code === code);
  if (!match) throw new Error("El código no existe o ya no está activo.");
  if (match.audience === "business") {
    if (!customerUid) throw new Error("Iniciá sesión con tu cuenta comercial para usar este código.");
    const profile = await refreshUserProfile(customerUid);
    if (profile?.accountType !== "business") throw new Error("Este código es exclusivo para comercios registrados.");
  }
  const today = localDateKey();
  if (match.validFrom && today < match.validFrom) throw new Error("Este código todavía no está vigente.");
  if (match.validUntil && today > match.validUntil) throw new Error("Este código está vencido.");
  if (match.usageLimit > 0 && match.usageCount >= match.usageLimit) throw new Error("Este código alcanzó su límite de usos.");
  if (match.perUserLimit && match.perUserLimit > 0) {
    if (!customerUid) throw new Error("Iniciá sesión para usar este código.");
    const db = getDb();
    if (!db) throw new Error("Firebase no está configurado.");
    const usages = await getDocs(query(
      collection(db, "discountCodeUsages"),
      where("code", "==", match.code),
      where("customerUid", "==", customerUid),
      limit(match.perUserLimit),
    ));
    if (usages.size >= match.perUserLimit) throw new Error("Ya alcanzaste el límite de usos de este cupón.");
  }
  const result = calculateDiscount(match, items, productsById);
  if (!result.eligibleItemIds.length) {
    throw new Error("Este carrito no tiene productos sin promoción para aplicar el descuento.");
  }
  return result;
}
