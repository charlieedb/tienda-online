import type { CatalogManifest, CatalogProvider, Product } from "./types";

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

function normalizeProduct(raw: RawProduct, index: number, prices: PriceOverlay): Product {
  const code = text(raw["Código"] ?? raw.Codigo ?? raw.codigo ?? raw["C��digo"]);
  const name = text(raw.Nombre ?? raw.nombre) || "Producto sin nombre";
  const category = text(raw.Linea ?? raw.linea ?? raw.Categoria ?? raw.categoria) || "Sin categoría";
  const packQty = Math.max(1, Math.trunc(number(raw.Presentacion ?? raw.presentacion) || 1));
  const overlay = prices[code.toUpperCase()] ?? {};
  const unitPrice = number(overlay.precioUnidad ?? raw.Precio ?? raw.precio ?? raw.PrecioMostrador);
  const promoPackUnit = number(overlay.precioUnitarioPromoCaja ?? raw.precioUnitarioPromoCaja);
  const explicitPackPrice = number(overlay.precioCaja ?? raw.PrecioCaja ?? raw.precioCaja ?? raw.Precio_Caja);
  const packPrice = promoPackUnit > 0 ? promoPackUnit * packQty : explicitPackPrice || unitPrice * packQty;
  const offerDiscount = number(raw.descOferta ?? raw.descuentoPct ?? raw.descuento);
  const offer = bool(raw.oferta ?? raw.Oferta ?? raw.Promo ?? raw.promo) || promoPackUnit > 0;

  return {
    id: code || `${slug(name)}-${index}`,
    name,
    brand: category.toUpperCase() === "AA" ? "Exclusivos" : category,
    category,
    categoryId: slug(category),
    imageUrl: text(raw.imagenURL ?? raw.imgUrl ?? raw.ImgUrl ?? raw.foto) || undefined,
    unit: { label: "1 unidad", price: unitPrice },
    pack: packQty > 1 ? { qty: packQty, label: `Caja x${packQty}`, price: packPrice } : undefined,
    sortPrice: unitPrice,
    keywords: [code, name, category, text(raw.codigoBarra)].filter(Boolean),
    active: !bool(raw.sinStock ?? raw.SinStock),
    offer,
    offerDiscount: offerDiscount || undefined,
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
    const products = await loadProducts();
    const groups = new Map<string, Product[]>();
    for (const product of products) {
      const list = groups.get(product.categoryId) ?? [];
      list.push(product); groups.set(product.categoryId, list);
    }
    const categories = [...groups.entries()].map(([id, items]) => ({
      id,
      name: items[0]?.category === "AA" ? "Exclusivos" : items[0]?.category || "Sin categoría",
      description: `${items.filter((item) => item.active).length} disponibles`,
      color: "#d92822",
      image: items.find((item) => item.imageUrl)?.imageUrl || "/joma-express.png",
      count: items.length,
    })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { version: catalogVersion, featuredCount: Math.min(12, products.length), categories };
  };

  return {
    getManifest: () => manifest(),
    getFeaturedProducts: async () => (await loadProducts()).filter((item) => item.active).sort((a, b) => Number(b.offer) - Number(a.offer)).slice(0, 12),
    getCategoryProducts: async (categoryId) => (await loadProducts()).filter((item) => item.categoryId === categoryId),
    searchProducts: async (query) => {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      return (await loadProducts()).filter((item) => terms.every((term) => normalize(item.keywords.join(" ")).includes(term))).slice(0, 80);
    },
    getCatalogVersion: async () => (await manifest()).version,
  };
}
