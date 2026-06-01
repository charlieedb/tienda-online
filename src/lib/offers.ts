import type { Product } from "@/lib/products";
import { getActiveCatalogForOffers } from "@/lib/offersCatalog";

export async function getOffersOfDay(limit = 8): Promise<Product[]> {
  const catalog = await getActiveCatalogForOffers();
  const list = catalog
    .filter((p) => p.active && p.offer)
    .slice()
    .sort((a, b) => {
      const ad = a.offerDiscount ?? 0;
      const bd = b.offerDiscount ?? 0;
      if (ad !== bd) return bd - ad;
      return a.name.localeCompare(b.name);
    });
  if (!Number.isFinite(limit) || limit <= 0) return list;
  return list.slice(0, Math.max(1, Math.trunc(limit)));
}
