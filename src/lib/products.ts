import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { seedProducts } from "@/lib/seedProducts";

export type Product = {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  unit: { label: string; price: number };
  pack?: { qty: number; label: string; price: number };
  keywords: string[];
  active: boolean;
  offer?: boolean;
  offerDiscount?: number;
};

const MAX_RESULTS = 30;
const CATALOG_LIMIT = 400;
const LS_KEY = "listita.catalog.v1";

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const v0 = new Array<number>(b.length + 1);
  const v1 = new Array<number>(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j]!;
  }
  return v1[b.length]!;
}

let cachedCatalog: { at: number; items: Product[] } | null = null;
let inFlightCatalog: Promise<Product[]> | null = null;
let catalogOrigin: "api" | "firestore" | "seed" | null = null;

type CatalogApiPayload = { version: number; items: Product[] };

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadCatalogFromLocalStorage(): CatalogApiPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return null;
  const parsed = safeParseJson<CatalogApiPayload>(raw);
  if (!parsed || !Array.isArray(parsed.items)) return null;
  return parsed;
}

function saveCatalogToLocalStorage(payload: CatalogApiPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / privacy mode.
  }
}

async function fetchCatalogFromApi(): Promise<CatalogApiPayload | null> {
  if (typeof window === "undefined") return null;
  try {
    // Always use the local Next API route.
    // In production (Vercel), the API route reads `CATALOGO_SOURCE_URL` server-side (no browser CORS).
    const res = await fetch("/api/catalog", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as CatalogApiPayload;
    if (!json || !Array.isArray(json.items)) return null;
    return json;
  } catch {
    return null;
  }
}

export async function getActiveCatalog(): Promise<Product[]> {
  // Prefer the local catalog exposed via Next API (backed by the existing `catalogo/productos.json`).
  if (typeof window !== "undefined") {
    const now = Date.now();
    if (cachedCatalog && now - cachedCatalog.at < 60_000) return cachedCatalog.items;
    if (inFlightCatalog) return inFlightCatalog;

    const fromLs = loadCatalogFromLocalStorage();
    if (fromLs?.items?.length) {
      cachedCatalog = { at: Date.now(), items: fromLs.items };
      catalogOrigin = "api";
      return fromLs.items;
    }

    inFlightCatalog = (async () => {
      const fromApi = await fetchCatalogFromApi();
      if (fromApi?.items?.length) {
        saveCatalogToLocalStorage(fromApi);
        cachedCatalog = { at: Date.now(), items: fromApi.items };
        catalogOrigin = "api";
        return fromApi.items;
      }

      // Fall back to the previous behavior (Firestore or seed).
      const db = getDb();
      if (!db) {
        const items = seedProducts.filter((p) => p.active);
        cachedCatalog = { at: Date.now(), items };
        catalogOrigin = "seed";
        return items;
      }

      const q = query(
        collection(db, "products"),
        where("active", "==", true),
        limit(CATALOG_LIMIT),
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, "id">),
      }));
      cachedCatalog = { at: Date.now(), items };
      catalogOrigin = "firestore";
      return items;
    })().finally(() => {
      inFlightCatalog = null;
    });

    return inFlightCatalog;
  }

  const db = getDb();
  if (!db) return seedProducts.filter((p) => p.active);

  const now = Date.now();
  if (cachedCatalog && now - cachedCatalog.at < 60_000) return cachedCatalog.items;
  if (inFlightCatalog) return inFlightCatalog;

  inFlightCatalog = (async () => {
    const q = query(
      collection(db, "products"),
      where("active", "==", true),
      limit(CATALOG_LIMIT),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Product, "id">),
    }));
    cachedCatalog = { at: Date.now(), items };
    catalogOrigin = "firestore";
    return items;
  })().finally(() => {
    inFlightCatalog = null;
  });

  return inFlightCatalog;
}

function productMatchesToken(product: Product, token: string) {
  const t = normalizeForSearch(token);
  if (!t) return false;

  const keywords = (product.keywords ?? []).map(normalizeForSearch);
  if (keywords.includes(t)) return true;

  // Substring match only for 3+ chars to avoid noisy matches.
  if (t.length >= 3) {
    const name = normalizeForSearch(product.name);
    const brand = normalizeForSearch(product.brand ?? "");
    if (name.includes(t) || brand.includes(t)) return true;
  }

  return false;
}

function buildKeywordUniverse(catalog: Product[]) {
  const set = new Set<string>();
  for (const p of catalog) {
    for (const k of p.keywords ?? []) {
      const nk = normalizeForSearch(k);
      if (nk) set.add(nk);
    }
  }
  return Array.from(set);
}

function suggestKeywords(input: string, universe: string[]) {
  const t = normalizeForSearch(input);
  if (!t) return [];

  const maxDist =
    t.length <= 4 ? 1 : t.length <= 7 ? 2 : 2;

  const scored = universe
    .map((k) => ({ k, d: levenshtein(k, t) }))
    .filter(({ d }) => d <= maxDist)
    .sort((a, b) => a.d - b.d || a.k.localeCompare(b.k))
    .slice(0, 5)
    .map(({ k }) => k);

  return scored;
}

export async function getProductById(productId: string): Promise<Product | null> {
  const catalog = await getActiveCatalog();
  return catalog.find((p) => p.id === productId) ?? null;
}

export async function searchProductsByToken(token: string): Promise<{
  products: Product[];
  suggestions: string[];
}> {
  const t = normalizeForSearch(token);
  if (!t) return { products: [], suggestions: [] };

  if (typeof window !== "undefined" && catalogOrigin === null) {
    const fromLs = loadCatalogFromLocalStorage();
    if (fromLs?.items?.length) {
      cachedCatalog = { at: Date.now(), items: fromLs.items };
      catalogOrigin = "api";
    }
  }

  const db = getDb();

  // Fast path: exact keyword match via Firestore only when the catalog is backed by Firestore.
  if (db && catalogOrigin !== "api") {
    const q = query(
      collection(db, "products"),
      where("active", "==", true),
      where("keywords", "array-contains", t),
      limit(MAX_RESULTS),
    );
    const snap = await getDocs(q);
    const products = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Product, "id">),
    }));
    if (products.length > 0) return { products, suggestions: [] };
  }

  // Fallback/augment: local filtering from catalog (covers seed + partial matches).
  const catalog = await getActiveCatalog();
  const products = catalog
    .filter((p) => productMatchesToken(p, t))
    .slice(0, MAX_RESULTS);

  if (products.length > 0) return { products, suggestions: [] };

  const universe = buildKeywordUniverse(catalog);
  const suggestions = suggestKeywords(t, universe);
  return { products: [], suggestions };
}
