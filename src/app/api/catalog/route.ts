import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type SourceRow = {
  Precio?: number;
  PrecioMostrador?: number | null;
  Presentacion?: string | number | null;
  Promo?: boolean;
  oferta?: boolean;
  descOferta?: number | null;
  imagenURL?: string | null;
  sinStock?: boolean;
  Linea?: string | null;
  Nombre?: string | null;
  "Código"?: string | null;
  _nCodigo?: string | null;
  _nNombre?: string | null;
  _nLinea?: string | null;
  ofertaOnline?: {
    active?: boolean;
    type?: "unit" | "quantity" | "pack";
    finalPrice?: number;
    minQuantity?: number;
    maxUnits?: number;
    allowCoupons?: boolean;
  };
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  unit: { label: string; price: number; listPrice?: number; discountPct?: number };
  pack?: { qty: number; label: string; price: number; listPrice?: number; discountPct?: number };
  packPromoUnitPrice?: number;
  sortPrice: number;
  keywords: string[];
  active: boolean;
  offer?: boolean;
  offerDiscount?: number;
  offerCondition?: "pack" | "quantity";
  offerMinQty?: number;
  offerUnitPrice?: number;
  offerMaxUnits?: number;
  offerAllowCoupons?: boolean;
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

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toInt(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  const i = Math.trunc(n);
  if (!Number.isFinite(i) || i <= 0) return null;
  return i;
}

function storageSafeCode(code: string) {
  return code.replaceAll("/", "_");
}

function mapRowToProduct(row: SourceRow): Product | null {
  const codigo = String(row["Código"] ?? "").trim();
  const nombre = String(row.Nombre ?? "").trim();
  if (!codigo || !nombre) return null;

  const packQty = toInt(row.Presentacion);
  const unitPrice = toNumber(row.Precio) ?? 0;
  const online = row.ofertaOnline?.active !== false ? row.ofertaOnline : undefined;
  const onlineType = online && ["unit", "quantity", "pack"].includes(String(online.type)) ? online.type : undefined;
  const onlineFinalPrice = toNumber(online?.finalPrice);
  const packPromoUnitPrice = onlineType === "pack" ? onlineFinalPrice : null;
  const packPrice =
    packQty && unitPrice ? Math.round((packPromoUnitPrice || unitPrice) * packQty * 100) / 100 : null;

  const pack = packQty
    ? {
        qty: packQty,
        label: `caja x${packQty}`,
        price: packPrice ?? 0,
        listPrice: packPromoUnitPrice ? Math.round(unitPrice * packQty * 100) / 100 : undefined,
        discountPct: packPromoUnitPrice && unitPrice > 0 ? (1 - packPromoUnitPrice / unitPrice) * 100 : undefined,
      }
    : undefined;

  const category = String(row.Linea ?? "").trim() || undefined;
  const brand = category;
  const keywordsBase = [
    row._nNombre ? String(row._nNombre) : nombre,
    row._nCodigo ? String(row._nCodigo) : codigo,
    row._nLinea ? String(row._nLinea) : category ?? "",
  ]
    .flatMap((v) => normalizeForSearch(v).split(" "))
    .filter(Boolean);

  const keywords = uniq([
    normalizeForSearch(nombre),
    normalizeForSearch(codigo),
    normalizeForSearch(brand ?? ""),
    ...keywordsBase,
  ]).filter(Boolean);

  const active = row.sinStock === true ? false : true;

  const bucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    "";

  const safeCode = storageSafeCode(codigo);
  const fallbackImageUrl = bucket
    ? `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(`fotosProductos/${safeCode}.jpg`)}?alt=media`
    : undefined;
  const imageUrl = String(row.imagenURL ?? "").trim() || fallbackImageUrl;

  const offer = Boolean(onlineType && onlineFinalPrice && onlineFinalPrice > 0);
  const offerDiscount = offer && onlineType === "unit" && unitPrice > 0
    ? Math.max(0, (1 - Number(onlineFinalPrice) / unitPrice) * 100)
    : undefined;

  return {
    id: codigo,
    name: nombre,
    brand,
    category,
    imageUrl,
    unit: {
      label: "unidad",
      price: onlineType === "unit" && onlineFinalPrice ? onlineFinalPrice : unitPrice,
      listPrice: onlineType === "unit" && onlineFinalPrice ? unitPrice : undefined,
      discountPct: offerDiscount,
    },
    pack,
    sortPrice: Math.max(unitPrice, 0),
    keywords,
    active,
    offer,
    offerDiscount: offerDiscount ?? undefined,
    offerCondition: onlineType === "pack" ? "pack" : onlineType === "quantity" ? "quantity" : undefined,
    packPromoUnitPrice: packPromoUnitPrice ?? undefined,
    offerMinQty: onlineType === "quantity" ? Math.max(2, toInt(online?.minQuantity) || 2) : undefined,
    offerUnitPrice: onlineType === "quantity" ? onlineFinalPrice ?? undefined : undefined,
    offerMaxUnits: Math.max(0, toInt(online?.maxUnits) || 0) || undefined,
    offerAllowCoupons: online?.allowCoupons === true,
  };
}

function defaultCatalogJsonPath() {
  // Default workspace layout:
  // `D:\APP WEB\TIENDA ONLINE\tienda-online` -> `D:\APP WEB\catalogo\productos.json`
  return path.resolve(process.cwd(), "..", "..", "catalogo", "productos.json");
}

let cached: { version: number; cacheKey: string; items: Product[] } | null = null;
let inflight: Promise<{ version: number; cacheKey: string; items: Product[] }> | null = null;

function buildCacheKey(headers: Headers) {
  const etag = headers.get("etag");
  const lastModified = headers.get("last-modified");
  return etag || lastModified || "no-cache-key";
}

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function GET(request: Request) {
  const sourceUrl = process.env.CATALOGO_SOURCE_URL?.trim() || "";
  const versionUrl =
    process.env.CATALOGO_VERSION_URL?.trim() ||
    (sourceUrl ? sourceUrl.replace(/productos\.json(\?.*)?$/i, "version.json$1") : "");
  if (sourceUrl) {
    // If we have a version endpoint, allow cheap version checks without downloading the whole catalog.
    // Controlled by query param: `/api/catalog?onlyVersion=1`
    // (fallback env `CATALOGO_ONLY_VERSION=1` is useful for debugging).
    const sp = new URL(request.url).searchParams;
    const onlyVersion =
      sp.get("onlyVersion") === "1" || process.env.CATALOGO_ONLY_VERSION === "1";

    if (onlyVersion && versionUrl) {
      try {
        const verRes = await fetch(versionUrl, { cache: "no-store" });
        if (verRes.ok) {
          const json = (await verRes.json()) as { version?: number };
          if (typeof json?.version === "number") {
            return NextResponse.json({ version: json.version });
          }
        }
      } catch {
        // Fall through to a best-effort response.
      }
      // Fallback: use the last catalog fetch cache key (ETag/Last-Modified) if we have one.
      // This lets clients detect changes even if `version.json` isn't updated.
      if (cached?.cacheKey && cached.cacheKey !== "no-cache-key" && cached.cacheKey !== "error") {
        return NextResponse.json({ version: stableHash(cached.cacheKey) });
      }
      return NextResponse.json({ version: cached?.version ?? Date.now() });
    }

    if (!inflight) {
      inflight = (async () => {
        const res = await fetch(sourceUrl, { cache: "no-store" });
        if (!res.ok) {
          return { version: Date.now(), cacheKey: "error", items: [] as Product[] };
        }
        const cacheKey = buildCacheKey(res.headers);
        if (cached && cached.cacheKey === cacheKey) {
          return cached;
        }
        const rows = (await res.json()) as SourceRow[];
        const items = rows.map(mapRowToProduct).filter(Boolean) as Product[];
        let version = Date.now();
        if (versionUrl) {
          try {
            const verRes = await fetch(versionUrl, { cache: "no-store" });
            if (verRes.ok) {
              const json = (await verRes.json()) as { version?: number };
              if (typeof json?.version === "number") version = json.version;
            }
          } catch {
            // ignore
          }
        }
        // If version endpoint isn't updated, fall back to cacheKey so clients still refresh.
        if (!versionUrl || version === Date.now()) {
          if (cacheKey && cacheKey !== "no-cache-key") version = stableHash(cacheKey);
        }
        const next = { version, cacheKey, items };
        cached = next;
        return next;
      })().finally(() => {
        inflight = null;
      });
    }

    const result = await inflight;
    return NextResponse.json({ version: result.version, items: result.items });
  }

  const catalogPath =
    process.env.CATALOGO_JSON_PATH?.trim() || defaultCatalogJsonPath();

  let stat: { mtimeMs: number };
  try {
    stat = await fs.stat(catalogPath);
  } catch {
    return NextResponse.json(
      { error: "CATALOG_NOT_FOUND", catalogPath },
      { status: 404 },
    );
  }

  if (cached && cached.cacheKey === String(stat.mtimeMs)) {
    return NextResponse.json({ version: cached.version, items: cached.items });
  }

  if (!inflight) {
    inflight = (async () => {
      const txt = await fs.readFile(catalogPath, "utf8");
      const rows = JSON.parse(txt) as SourceRow[];
      const items = rows.map(mapRowToProduct).filter(Boolean) as Product[];
      const next = { version: Date.now(), cacheKey: String(stat.mtimeMs), items };
      cached = next;
      return next;
    })().finally(() => {
      inflight = null;
    });
  }

  const res = await inflight;
  return NextResponse.json({ version: res.version, items: res.items });
}
