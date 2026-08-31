import type { CatalogManifest, CatalogProvider, Product } from "./types";
import { getFeaturedProductsConfig } from "@/lib/featuredProducts";
import {
  getSpeedProductPriority,
  isSpeedPrioritySearch,
  prioritizeSpeedProducts,
} from "@/lib/productSearchPriority";

const VERSION_URL = "/api/catalog-version";
const PRODUCTS_URL = "/api/catalog-products";
const CACHE_VERSION_KEY = "joma.catalog.version";
const CACHE_PRODUCTS_KEY = "joma.catalog.products";

type RawProduct = Record<string, unknown>;
type PriceOverlay = Record<string, { precioUnidad?: number; precioCaja?: number; precioUnitarioPromoCaja?: number }>;

function text(value: unknown) { return String(value ?? "").trim(); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function normalize(value: string) { return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function slug(value: string) { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-categoria"; }
function bool(value: unknown) { return value === true || ["1", "true", "si", "sí"].includes(text(value).toLowerCase()); }
function roundPrice(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function discountBetween(listPrice: number, finalPrice: number) {
  return listPrice > 0 && finalPrice < listPrice ? roundPrice((1 - finalPrice / listPrice) * 100) : 0;
}
function sortProducts(a: Product, b: Product) {
  return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
}

function stableImageUrl(value: unknown) {
  return text(value) || undefined;
}

function selectFeatured(products: Product[], ids: string[], configured: boolean) {
  const available = products.filter((item) => item.active);
  if (!configured) return available.filter((item) => item.offer).sort(sortProducts);
  const byId = new Map(available.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is Product => Boolean(item));
}

function normalizeProduct(raw: RawProduct, index: number, prices: PriceOverlay): Product {
  const code = text(raw["Código"] ?? raw.Codigo ?? raw.codigo);
  const name = text(raw.Nombre ?? raw.nombre) || "Producto sin nombre";
  const category = text(raw.Linea ?? raw.linea ?? raw.Categoria ?? raw.categoria) || "Sin categoría";
  const packQty = Math.max(1, Math.trunc(number(raw.Presentacion ?? raw.presentacion) || 1));
  const overlay = prices[code.toUpperCase()] ?? {};
  const unitPrice = number(overlay.precioUnidad ?? raw.Precio ?? raw.precio ?? raw.PrecioMostrador);
  const online = raw.ofertaOnline && typeof raw.ofertaOnline === "object" ? raw.ofertaOnline as RawProduct : null;
  const onlineActive = online && online.active !== false;
  const onlineType = onlineActive && ["unit", "quantity", "pack"].includes(text(online.type)) ? text(online.type) : "";
  const onlineFinal = number(online?.finalPrice);
  const promoPackUnit = onlineType === "pack" ? onlineFinal : 0;
  const explicitPackPrice = number(overlay.precioCaja ?? raw.PrecioCaja ?? raw.precioCaja ?? raw.Precio_Caja);
  const packListPrice = explicitPackPrice || unitPrice * packQty;
  const offerDiscount = onlineType === "unit" && unitPrice > 0 && onlineFinal > 0
    ? discountBetween(unitPrice, onlineFinal)
    : 0;
  const unitFinalPrice = offerDiscount > 0 ? roundPrice(unitPrice * (1 - offerDiscount / 100)) : unitPrice;
  const packPrice = promoPackUnit > 0
    ? roundPrice(promoPackUnit * packQty)
    : offerDiscount > 0 ? roundPrice(packListPrice * (1 - offerDiscount / 100)) : packListPrice;
  const packDiscount = discountBetween(packListPrice, packPrice);
  const offer = Boolean(onlineType && onlineFinal > 0);
  const isCombo = bool(raw.esCombo) || normalize(category).includes("promo");
  const stockValue = raw.stockReal;
  const parsedStock = stockValue === null || stockValue === undefined || stockValue === "" ? undefined : Number(stockValue);
  const stockReal = parsedStock !== undefined && Number.isFinite(parsedStock) ? parsedStock : undefined;
  const hiddenFromStore = /^R/i.test(code);
  const onlineManual = typeof raw.publicarOnlineManual === "boolean" ? raw.publicarOnlineManual : null;
  const activeByStock = stockReal !== undefined ? stockReal > 0 : !bool(raw.sinStock ?? raw.SinStock);

  return {
    id: code || `${slug(name)}-${index}`,
    name,
    brand: category.toUpperCase() === "AA" ? "Exclusivos" : category,
    category,
    categoryId: isCombo ? "combos" : slug(category),
    imageUrl: stableImageUrl(
      raw.imgUrl ??
        raw.ImgUrl ??
        raw.imagenThumbURL ??
        raw.imagenURL ??
        raw.foto,
    ),
    imageFallbackUrl: stableImageUrl(raw.imagenURL ?? raw.foto),
    unit: { label: "1 unidad", price: unitFinalPrice, listPrice: offerDiscount > 0 ? unitPrice : undefined, discountPct: offerDiscount || undefined },
    pack: packQty > 1 ? { qty: packQty, label: `Caja x${packQty}`, price: packPrice, listPrice: packDiscount > 0 ? packListPrice : undefined, discountPct: packDiscount || undefined } : undefined,
    sortPrice: unitPrice,
    keywords: [code, name, category, text(raw.codigoBarra)].filter(Boolean),
    active: !hiddenFromStore && (onlineManual ?? (raw.publicarOnline !== false && activeByStock)),
    stockReal,
    offer,
    offerDiscount: offerDiscount || packDiscount || undefined,
    offerCondition: onlineType === "pack" ? "pack" : onlineType === "quantity" ? "quantity" : undefined,
    packPromoUnitPrice: promoPackUnit > 0 ? promoPackUnit : undefined,
    offerMinQty: onlineType === "quantity" ? Math.max(2, Math.trunc(number(online?.minQuantity) || 2)) : undefined,
    offerUnitPrice: onlineType === "quantity" ? onlineFinal : undefined,
    offerMaxUnits: Math.max(0, Math.trunc(number(online?.maxUnits))) || undefined,
    offerAllowCoupons: online?.allowCoupons === true,
  };
}

export function createRemoteCatalog(): CatalogProvider {
  let productsPromise: Promise<Product[]> | null = null;
  let catalogVersion = 0;

  const fetchRemoteVersion = async () => {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No pudimos verificar la versión del catálogo.");
    const data = await response.json() as { version?: number };
    return Number(data.version || 0);
  };

  const loadProducts = () => {
    if (productsPromise) return productsPromise;
    productsPromise = (async () => {
      let cachedVersion = 0;
      let cachedRows: RawProduct[] = [];
      try {
        cachedVersion = Number(localStorage.getItem(CACHE_VERSION_KEY) || 0);
        const value = localStorage.getItem(CACHE_PRODUCTS_KEY);
        cachedRows = value ? JSON.parse(value) as RawProduct[] : [];
      } catch { /* caché no disponible */ }

      try {
        catalogVersion = await fetchRemoteVersion();
      } catch (error) {
        if (cachedRows.length) {
          catalogVersion = cachedVersion;
          return cachedRows.map((raw, index) => normalizeProduct(raw, index, {}));
        }
        throw error;
      }

      if (cachedRows.length && cachedVersion === catalogVersion) {
        return cachedRows.map((raw, index) => normalizeProduct(raw, index, {}));
      }

      const productsResponse = await fetch(`${PRODUCTS_URL}?v=${catalogVersion}`, { cache: "no-store" });
      if (!productsResponse.ok) throw new Error("No pudimos descargar el catálogo actualizado.");
      const data = await productsResponse.json() as RawProduct[] | { items?: RawProduct[] };
      const rows = Array.isArray(data) ? data : data.items ?? [];
      try {
        localStorage.setItem(CACHE_PRODUCTS_KEY, JSON.stringify(rows));
        localStorage.setItem(CACHE_VERSION_KEY, String(catalogVersion));
      } catch { /* la app continúa con caché en memoria */ }
      return rows.map((raw, index) => normalizeProduct(raw, index, {}));
    })().catch((error) => { productsPromise = null; throw error; });
    return productsPromise;
  };

  const manifest = async (): Promise<CatalogManifest> => {
    const [products, featuredConfig] = await Promise.all([loadProducts(), getFeaturedProductsConfig()]);
    const visibleProducts = products.filter((item) => item.active);
    const featured = selectFeatured(products, featuredConfig.ids, featuredConfig.configured);
    const groups = new Map<string, Product[]>();
    for (const product of visibleProducts) {
      const list = groups.get(product.categoryId) ?? [];
      list.push(product); groups.set(product.categoryId, list);
    }
    const categories = [...groups.entries()].map(([id, items]) => ({
      id,
      name: id === "combos" ? "Combos" : items[0]?.category === "AA" ? "Exclusivos" : items[0]?.category || "Sin categoría",
      description: `${items.filter((item) => item.active).length} disponibles`,
      color: "#d92822",
      image: items.find((item) => item.imageUrl)?.imageUrl || "/joma-express-icon.png",
      count: items.filter((item) => item.active).length,
    })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { version: catalogVersion, featuredCount: featured.length, categories };
  };

  return {
    getManifest: () => manifest(),
    getFeaturedProducts: async () => {
      const [products, config] = await Promise.all([loadProducts(), getFeaturedProductsConfig()]);
      return selectFeatured(products, config.ids, config.configured);
    },
    getOfferProducts: async () => (await loadProducts()).filter((item) => item.active && item.offer).sort(sortProducts),
    getCategoryProducts: async (categoryId) => (await loadProducts()).filter((item) => item.active && item.categoryId === categoryId).sort(sortProducts),
    searchProducts: async (query) => {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      const speedSearch = isSpeedPrioritySearch(query);
      const products = (await loadProducts()).filter((item) =>
        (item.active && terms.every((term) => normalize(item.keywords.join(" ")).includes(term)))
        || (speedSearch && getSpeedProductPriority(item.id, query) !== null),
      );
      return prioritizeSpeedProducts(products.sort(sortProducts), query).slice(0, 80);
    },
    getProduct: async (productId) => (await loadProducts()).find((item) => item.id === productId || slug(item.id) === productId) ?? null,
    getAllProducts: async () => (await loadProducts()).filter((item) => !/^R/i.test(item.id)).sort(sortProducts),
    getCatalogVersion: async () => (await manifest()).version,
    checkForUpdates: async () => {
      await loadProducts();
      const remoteVersion = await fetchRemoteVersion();
      if (!remoteVersion || remoteVersion === catalogVersion) return false;
      productsPromise = null;
      return true;
    },
  };
}
