import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type SourceRow = {
  Precio?: number;
  PrecioMostrador?: number | null;
  Presentacion?: string | number | null;
  Promo?: boolean;
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
  const packPrice = toNumber(row.Precio);
  const unitPriceExplicit = toNumber(row.PrecioMostrador);

  const unitPrice =
    unitPriceExplicit ??
    (packQty && packPrice ? Math.round((packPrice / packQty) * 100) / 100 : null) ??
    0;

  const pack =
    packQty && packPrice
      ? { qty: packQty, label: `caja x${packQty}`, price: packPrice }
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

  return {
    id: codigo,
    name: nombre,
    brand,
    unit: { label: "unidad", price: unitPrice },
    pack,
    keywords,
    active,
  };
}

function defaultCatalogJsonPath() {
  // Default workspace layout:
  // `D:\APP WEB\TIENDA ONLINE\tienda-online` -> `D:\APP WEB\catalogo\productos.json`
  return path.resolve(process.cwd(), "..", "..", "catalogo", "productos.json");
}

let cached: { mtimeMs: number; items: Product[] } | null = null;
let inflight: Promise<{ mtimeMs: number; items: Product[] }> | null = null;

export async function GET() {
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

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return NextResponse.json({ version: stat.mtimeMs, items: cached.items });
  }

  if (!inflight) {
    inflight = (async () => {
      const txt = await fs.readFile(catalogPath, "utf8");
      const rows = JSON.parse(txt) as SourceRow[];
      const items = rows.map(mapRowToProduct).filter(Boolean) as Product[];
      cached = { mtimeMs: stat.mtimeMs, items };
      return { mtimeMs: stat.mtimeMs, items };
    })().finally(() => {
      inflight = null;
    });
  }

  const res = await inflight;
  return NextResponse.json({ version: res.mtimeMs, items: res.items });
}
