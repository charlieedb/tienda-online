import type { CatalogManifest, CatalogProvider, Product } from "./types";
import { getFeaturedProductsConfig } from "@/lib/featuredProducts";

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
  const promoPackUnit = number(overlay.precioUnitarioPromoCaja ?? raw.precioUnitarioPromoCaja);
  const explicitPackPrice = number(overlay.precioCaja ?? raw.PrecioCaja ?? raw.precioCaja ?? raw.Precio_Caja);
  const packListPrice = explicitPackPrice || unitPrice * packQty;
  const offerDiscount = number(raw.descOferta ?? raw.descuentoPct ?? raw.descuento);
  const unitFinalPrice = offerDiscount > 0 ? roundPrice(unitPrice * (1 - offerDiscount / 100)) : unitPrice;
  const packPrice = promoPackUnit > 0
    ? roundPrice(promoPackUnit * packQty)
    : offerDiscount > 0 ? roundPrice(packListPrice * (1 - offerDiscount / 100)) : packListPrice;
  const packDiscount = discountBetween(packListPrice, packPrice);
  const offer = bool(raw.oferta ?? raw.Oferta ?? raw.Promo ?? raw.promo) || promoPackUnit > 0;
  const isCombo = bool(raw.esCombo) || normalize(category).includes("promo");
  const stockValue = raw.stockReal;
  const parsedStock = stockValue === null || stockValue === undefined || stockValue === "" ? undefined : Number(stockValue);
  const stockReal = parsedStock !== undefined && Number.isFinite(parsedStock) ? parsedStock : undefined;
  const hiddenFromStore = /^R/i.test(code);

  return {
    id: code || `${slug(name)}-${index}`,
    name,
    brand: category.toUpperCase() === "AA" ? "Exclusivos" : category,
    category,
    categoryId: isCombo ? "combos" : slug(category),
    imageUrl: text(raw.imagenURL ?? raw.imgUrl ?? raw.ImgUrl ?? raw.foto) || undefined,
    unit: { label: "1 unidad", price: unitFinalPrice, listPrice: offerDiscount > 0 ? unitPrice : undefined, discountPct: offerDiscount || undefined },
    pack: packQty > 1 ? { qty: packQty, label: `Caja x${packQty}`, price: packPrice, listPrice: packDiscount > 0 ? packListPrice : undefined, discountPct: packDiscount || undefined } : undefined,
    sortPrice: unitPrice,
    keywords: [code, name, category, text(raw.codigoBarra)].filter(Boolean),
    active: !hiddenFromStore && (stockReal !== undefined ? stockReal > 0 : !bool(raw.sinStock ?? raw.SinStock)),
    stockReal,
    offer,
    offerDiscount: offerDiscount || packDiscount || undefined,
    offerCondition: promoPackUnit > 0 ? "pack" : undefined,
  };
}

export function createRemoteCatalog(): CatalogProvider {
  let productsPromise: Promise<Product[]> | null = null;
  let catalogVersion = 0;

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
        const versionResponse = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!versionResponse.ok) throw new Error("No pudimos verificar la versión del catálogo.");
        const versionData = await versionResponse.json() as { version?: number };
        catalogVersion = Number(versionData.version || 0);
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
      image: items.find((item) => item.imageUrl)?.imageUrl || "/joma-express.png",
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
      return (await loadProducts()).filter((item) => item.active && terms.every((term) => normalize(item.keywords.join(" ")).includes(term))).sort(sortProducts).slice(0, 80);
    },
    getCatalogVersion: async () => (await manifest()).version,
  };
}
