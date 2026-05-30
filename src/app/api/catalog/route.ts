import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type SourceRow = {
  Precio?: number;
  PrecioMostrador?: number | null;
  Presentacion?: string | number | null;
  Promo?: boolean;
  oferta?: boolean;
  descOferta?: number | null;
  sinStock?: boolean;
  Linea?: string | null;
  Nombre?: string | null;
  "Código"?: string | null;
  _nCodigo?: string | null;
  _nNombre?: string | null;
  _nLinea?: string | null;
};

type Product = {
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

function mapRowToProduct(row: SourceRow): Product | null {
  const codigo = String(row["Código"] ?? "").trim();
  const nombre = String(row.Nombre ?? "").trim();
  if (!codigo || !nombre) return null;

  const packQty = toInt(row.Presentacion);
  const unitPrice = toNumber(row.Precio) ?? 0;
  const packPrice =
    packQty && unitPrice ? Math.round(unitPrice * packQty * 100) / 100 : null;

  const pack = packQty
    ? {
        qty: packQty,
        label: `caja x${packQty}`,
        price: packPrice ?? 0,
      }
    : undefined;

  const brand = String(row.Linea ?? "").trim() || undefined;
  const keywordsBase = [
    row._nNombre ? String(row._nNombre) : nombre,
    row._nCodigo ? String(row._nCodigo) : codigo,
    row._nLinea ? String(row._nLinea) : brand ?? "",
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

  const imageUrl = bucket
    ? `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(`fotosProductosThumb/${codigo}.jpg`)}?alt=media`
    : undefined;

  const offer = row.oferta === true || row.Promo === true;
  const offerDiscount = toNumber(row.descOferta);

  return {
    id: codigo,
    name: nombre,
    brand,
    imageUrl,
    unit: { label: "unidad", price: unitPrice },
    pack,
    keywords,
    active,
    offer,
    offerDiscount: offerDiscount ?? undefined,
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

export async function GET() {
  const sourceUrl = process.env.CATALOGO_SOURCE_URL?.trim() || "";
  if (sourceUrl) {
    if (cached && cached.cacheKey !== "no-cache-key") {
      // Best-effort revalidation using the last seen key.
      // If the origin provides ETag/Last-Modified, we can avoid re-parsing unchanged payloads.
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
        const next = { version: Date.now(), cacheKey, items };
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
