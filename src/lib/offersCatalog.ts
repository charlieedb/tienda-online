import type { Product } from "@/lib/products";
import { getActiveCatalog } from "@/lib/products";

export async function getActiveCatalogForOffers(): Promise<Product[]> {
  return getActiveCatalog();
}
