import { NextResponse } from "next/server";
import { buildTelegramOrderMessage, type TelegramOrderPayload } from "@/lib/telegramOrders";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePayload(body: unknown): TelegramOrderPayload | null {
  const root = asRecord(body);
  const pedido = asRecord(root?.pedido);
  const cliente = asRecord(root?.cliente);
  const totals = asRecord(root?.totals);
  const rawItems = Array.isArray(root?.items) ? root.items : null;

  if (!pedido || !cliente || !totals || !rawItems) return null;

  const items: TelegramOrderPayload["items"] = [];
  for (const item of rawItems) {
    const row = asRecord(item);
    if (!row) continue;
    const nombre = toText(row.nombre);
    if (!nombre) continue;
    items.push({
      codigo: toText(row.codigo),
      nombre,
      descuentoPct: toNumber(row.descuentoPct),
      cantidadUnidades: Math.max(0, Math.trunc(toNumber(row.cantidadUnidades))),
      cantidadCajas: Math.max(0, Math.trunc(toNumber(row.cantidadCajas))),
      unidadesPorCaja: Math.max(0, Math.trunc(toNumber(row.unidadesPorCaja))),
    });
  }

  const payload: TelegramOrderPayload = {
    pedido: {
      id: toText(pedido.id),
      createdAtIso: toText(pedido.createdAtIso),
      source: toText(pedido.source) || "tienda-online-next",
    },
    cliente: {
      nombre: toText(cliente.nombre),
      telefono: toText(cliente.telefono),
      direccion: toText(cliente.direccion),
      nota: toText(cliente.nota),
      ubicacion: (() => {
        const point = asRecord(cliente.ubicacion);
        if (!point) return null;
        const lat = Number(point.lat);
        const lng = Number(point.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      })(),
    },
    items,
    totals: {
      distinct: Math.max(0, Math.trunc(toNumber(totals.distinct))),
      totalQty: Math.max(0, Math.trunc(toNumber(totals.totalQty))),
      total: toNumber(totals.total),
      subtotal: toNumber(totals.subtotal),
      discountTotal: toNumber(totals.discountTotal),
    },
  };

  if (!payload.pedido.id || !payload.cliente.nombre || !payload.cliente.direccion) {
    return null;
  }

  return payload;
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "";

  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ORDER_PAYLOAD" },
      { status: 400 },
    );
  }

  const text = buildTelegramOrderMessage(payload);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;

    if (!response.ok || result?.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.description || "TELEGRAM_SEND_FAILED",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "TELEGRAM_SEND_FAILED",
      },
      { status: 502 },
    );
  }
}
