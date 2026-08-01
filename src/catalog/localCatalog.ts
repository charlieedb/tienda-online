import type { CatalogManifest, CatalogProvider, Product } from "./types";

const BASE = "/demo-catalog";
const memory = new Map<string, unknown>();

function normalize(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function readJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (memory.has(path)) return memory.get(path) as T;
  const response = await fetch(`${BASE}/${path}`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error("No pudimos cargar esta sección. Intentá nuevamente.");
  const value = (await response.json()) as T;
  memory.set(path, value);
  try { localStorage.setItem(`joma.demo.${path}`, JSON.stringify(value)); } catch { /* privacidad */ }
  return value;
}

async function readWithFallback<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    return await readJson<T>(path, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      const cached = localStorage.getItem(`joma.demo.${path}`);
      if (cached) return JSON.parse(cached) as T;
    } catch { /* caché inválida */ }
    throw error;
  }
}

export const localCatalog: CatalogProvider = {
  getManifest: (signal) => readWithFallback<CatalogManifest>("manifest.json", signal),
  getFeaturedProducts: async (signal) => {
    const items = await readWithFallback<Product[]>("featured.json", signal);
    return items.filter((item) => item.active).sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  },
  getOfferProducts: async (signal) => {
    const manifest = await localCatalog.getManifest(signal);
    const groups = await Promise.all(manifest.categories.map((category) => localCatalog.getCategoryProducts(category.id, signal)));
    return groups.flat().filter((item) => item.active && item.offer);
  },
  getCategoryProducts: async (categoryId, signal) => {
    if (!/^[a-z0-9-]+$/.test(categoryId)) return [];
    return readWithFallback<Product[]>(`categories/${categoryId}.json`, signal);
  },
  searchProducts: async (query, signal) => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const index = await readWithFallback<Array<{ id: string; categoryId: string; text: string }>>("search-index.json", signal);
    const matches = index.filter((entry) => terms.every((term) => normalize(entry.text).includes(term)));
    const categoryIds = [...new Set(matches.map((entry) => entry.categoryId))];
    const chunks = await Promise.all(categoryIds.map((id) => localCatalog.getCategoryProducts(id, signal)));
    const byId = new Map(chunks.flat().map((product) => [product.id, product]));
    return matches.map((entry) => byId.get(entry.id)).filter((item): item is Product => Boolean(item));
  },
  getAllProducts: async (signal) => {
    const manifest = await localCatalog.getManifest(signal);
    const groups = await Promise.all(manifest.categories.map((category) => localCatalog.getCategoryProducts(category.id, signal)));
    return groups.flat();
  },
  getProduct: async (productId, signal) => {
    const products = await localCatalog.getAllProducts(signal);
    return products.find((product) => product.id === productId || normalize(product.id).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === productId) ?? null;
  },
  getCatalogVersion: async (signal) => (await localCatalog.getManifest(signal)).version,
};
