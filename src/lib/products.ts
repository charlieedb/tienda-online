import { APP_VERSION } from "@/lib/appVersion";
import { seedProducts } from "@/lib/seedProducts";
import {
  getSpeedProductPriority,
  isSpeedPrioritySearch,
  prioritizeSpeedProducts,
} from "@/lib/productSearchPriority";

export type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  unit: { label: string; price: number };
  pack?: { qty: number; label: string; price: number };
  sortPrice: number;
  keywords: string[];
  active: boolean;
  offer?: boolean;
  offerDiscount?: number;
};

const LS_KEY = `listita.catalog.${APP_VERSION}`;
const VERSION_CHECK_TTL_MS = 7_000;
const EARLY_SUGGESTION_LIMIT = 6;
const CURATED_SEARCH_TERMS = [
  "aceite",
  "aceituna",
  "arroz",
  "azucar",
  "cafe",
  "cereal",
  "detergente",
  "fideos",
  "galletitas",
  "harina",
  "jabon",
  "jugo",
  "lavandina",
  "leche",
  "mayonesa",
  "pan",
  "pure de tomate",
  "queso",
  "sal",
  "salsa",
  "servilletas",
  "te",
  "vinagre",
  "yerba",
];
const CURATED_EMPTY_STATE_EXAMPLES = [
  "aceite",
  "yerba",
  "azucar",
  "arroz",
  "galletitas",
  "lavandina",
];

export type SearchPromptSuggestion = {
  kind: "typed" | "suggested" | "did_you_mean";
  label: string;
  value: string;
};

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandEquivalentTokens(token: string) {
  const t = normalizeForSearch(token);
  if (!t) return [];

  const variants = new Set<string>([t]);

  // Treat singular/plural category typos as the same logical token.
  if (t.length > 4) {
    if (t.endsWith("s")) variants.add(t.slice(0, -1));
    else variants.add(`${t}s`);
  }

  return Array.from(variants).filter(Boolean);
}

function canonicalizeCategoryToken(value: string) {
  const token = normalizeForSearch(value);
  if (!token) return "";
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function isUsefulAutocompleteToken(value: string) {
  if (!value) return false;
  if (value.length < 3 || value.length > 32) return false;
  if (/^\d+$/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  return true;
}

function addAutocompleteCandidate(bucket: Set<string>, raw: string) {
  const normalized = normalizeForSearch(raw);
  if (!normalized) return;

  if (isUsefulAutocompleteToken(normalized)) bucket.add(normalized);

  for (const part of normalized.split(" ")) {
    if (!isUsefulAutocompleteToken(part)) continue;
    bucket.add(part);
  }
}

function toSuggestionDisplay(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
type StoredCatalog = { v: 1; version: number; savedAt: number; items: Product[] };

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
  const parsed = safeParseJson<StoredCatalog>(raw);
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return null;
  return { version: parsed.version, items: parsed.items };
}

function saveCatalogToLocalStorage(payload: CatalogApiPayload) {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredCatalog = {
      v: 1,
      version: payload.version,
      savedAt: Date.now(),
      items: payload.items,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(stored));
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

async function fetchCatalogVersion(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/catalog?onlyVersion=1", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { version?: number };
    if (typeof json?.version !== "number") return null;
    return json.version;
  } catch {
    return null;
  }
}

let lastVersionCheckAt = 0;
let refreshTimer: number | null = null;

async function refreshCatalogIfStale() {
  const fromLs = loadCatalogFromLocalStorage();
  if (!fromLs?.items?.length) return;
  const latest = await fetchCatalogVersion();
  if (latest === null) return;
  if (latest === fromLs.version) return;
  const refreshed = await fetchCatalogFromApi();
  if (!refreshed?.items?.length) return;
  saveCatalogToLocalStorage(refreshed);
  cachedCatalog = { at: Date.now(), items: refreshed.items };
  catalogOrigin = "api";
}

export function startCatalogAutoRefresh() {
  if (typeof window === "undefined") return () => {};
  if (refreshTimer) return () => stopCatalogAutoRefresh();

  const tick = async () => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastVersionCheckAt < VERSION_CHECK_TTL_MS) return;
    lastVersionCheckAt = now;
    await refreshCatalogIfStale();
  };

  refreshTimer = window.setInterval(() => {
    tick();
  }, 2000);

  // Run once immediately.
  tick();

  return () => stopCatalogAutoRefresh();
}

export function stopCatalogAutoRefresh() {
  if (typeof window === "undefined") return;
  if (!refreshTimer) return;
  window.clearInterval(refreshTimer);
  refreshTimer = null;
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

      // Best-effort freshness: check version occasionally, and refresh the cache if it changed.
      if (now - lastVersionCheckAt > VERSION_CHECK_TTL_MS) {
        lastVersionCheckAt = now;
        queueMicrotask(() => {
          refreshCatalogIfStale();
        });
      }

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

      const items = seedProducts.filter((p) => p.active);
      cachedCatalog = { at: Date.now(), items };
      catalogOrigin = "seed";
      return items;
    })().finally(() => {
      inFlightCatalog = null;
    });

    return inFlightCatalog;
  }

  const now = Date.now();
  if (cachedCatalog && now - cachedCatalog.at < 60_000) return cachedCatalog.items;
  if (inFlightCatalog) return inFlightCatalog;

  inFlightCatalog = (async () => {
    const items = seedProducts.filter((p) => p.active);
    cachedCatalog = { at: Date.now(), items };
    catalogOrigin = "seed";
    return items;
  })().finally(() => {
    inFlightCatalog = null;
  });

  return inFlightCatalog;
}

function productMatchesToken(product: Product, token: string) {
  const candidates = expandEquivalentTokens(token);
  if (candidates.length === 0) return false;

  const keywords = (product.keywords ?? []).map(normalizeForSearch);
  if (candidates.some((candidate) => keywords.includes(candidate))) return true;

  // Substring match only for 3+ chars to avoid noisy matches.
  const name = normalizeForSearch(product.name);
  const brand = normalizeForSearch(product.brand ?? "");
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    if (name.includes(candidate) || brand.includes(candidate)) return true;
  }

  return false;
}

function productMatchesCategoryToken(product: Product, token: string) {
  const candidates = expandEquivalentTokens(token);
  if (candidates.length === 0) return false;

  const brandToken = canonicalizeCategoryToken(product.brand ?? "");
  if (!brandToken) return false;

  return candidates.some((candidate) => canonicalizeCategoryToken(candidate) === brandToken);
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

function buildAutocompleteUniverse(catalog: Product[]) {
  const set = new Set<string>();

  for (const term of CURATED_SEARCH_TERMS) {
    addAutocompleteCandidate(set, term);
  }

  for (const product of catalog) {
    addAutocompleteCandidate(set, product.name);
    addAutocompleteCandidate(set, product.brand ?? "");
    for (const keyword of product.keywords ?? []) {
      addAutocompleteCandidate(set, keyword);
    }
  }

  return Array.from(set);
}

export async function getSearchPromptSuggestions(input: string): Promise<SearchPromptSuggestion[]> {
  const raw = input.trim();
  const token = normalizeForSearch(raw);
  if (!token || token.length < 2) return [];

  const catalog = await getActiveCatalog();
  const universe = buildAutocompleteUniverse(catalog);

  const ranked = universe
    .map((candidate) => {
      const starts = candidate.startsWith(token);
      const includes = !starts && candidate.includes(token);
      if (!starts && !includes) return null;
      const exact = candidate === token;
      const wordStart = candidate.split(" ").some((part) => part.startsWith(token));
      return {
        candidate,
        score: [
          exact ? 0 : 1,
          starts ? 0 : wordStart ? 1 : 2,
          candidate.length,
          candidate,
        ] as const,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      return (
        a.score[0] - b.score[0] ||
        a.score[1] - b.score[1] ||
        a.score[2] - b.score[2] ||
        a.score[3].localeCompare(b.score[3], "es", { sensitivity: "base" })
      );
    })
    .slice(0, EARLY_SUGGESTION_LIMIT)
    .map((entry) => entry?.candidate ?? "")
    .filter(Boolean);

  const suggestions: SearchPromptSuggestion[] = [
    {
      kind: "typed",
      label: raw,
      value: raw,
    },
  ];

  const seen = new Set<string>([token]);
  const keywordUniverse = buildKeywordUniverse(catalog);
  const correction = suggestKeywords(token, keywordUniverse)[0];

  if (correction && normalizeForSearch(correction) !== token) {
    suggestions.push({
      kind: "did_you_mean",
      label: `Quisiste decir ${toSuggestionDisplay(correction)}`,
      value: correction,
    });
    seen.add(normalizeForSearch(correction));
  }

  for (const candidate of ranked) {
    const normalizedCandidate = normalizeForSearch(candidate);
    if (!normalizedCandidate || seen.has(normalizedCandidate)) continue;
    suggestions.push({
      kind: "suggested",
      label: candidate,
      value: candidate,
    });
    seen.add(normalizedCandidate);
  }

  return suggestions.slice(0, EARLY_SUGGESTION_LIMIT + 2);
}

export function getTrendingSearchPrompts() {
  return [...CURATED_EMPTY_STATE_EXAMPLES];
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

  // NOTE: We intentionally avoid querying Firestore here to prevent extra reads and permission issues.

  // Fallback/augment: local filtering from catalog (covers seed + partial matches).
  const catalog = await getActiveCatalog();
  const speedSearch = isSpeedPrioritySearch(t);
  const products = prioritizeSpeedProducts(
    catalog.filter((product) =>
      productMatchesToken(product, t)
      || (speedSearch && getSpeedProductPriority(product.id, t) !== null),
    ),
    t,
  );

  if (products.length > 0) return { products, suggestions: [] };

  const universe = buildKeywordUniverse(catalog);
  const suggestions = suggestKeywords(t, universe);
  return { products: [], suggestions };
}

export async function searchProductsByCategoryToken(token: string): Promise<{
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

  const catalog = await getActiveCatalog();
  const products = catalog.filter((p) => productMatchesCategoryToken(p, t));
  return { products, suggestions: [] };
}
