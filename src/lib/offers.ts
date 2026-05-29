import type { Product } from "@/lib/products";
import { getActiveCatalogForOffers } from "@/lib/offersCatalog";

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getOffersOfDay(limit = 8): Promise<Product[]> {
  const catalog = await getActiveCatalogForOffers();
  const key = todayKey();
  return catalog
    .slice()
    .sort((a, b) => stableHash(key + a.id) - stableHash(key + b.id))
    .slice(0, Math.max(1, limit));
}

