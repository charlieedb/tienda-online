export type TelegramOrderItem = {
  codigo: string;
  nombre: string;
  descuentoPct?: number;
  cantidadUnidades: number;
  cantidadCajas: number;
  unidadesPorCaja: number;
};

export type TelegramOrderPayload = {
  pedido: {
    id: string;
    createdAtIso: string;
    source: string;
  };
  cliente: {
    nombre: string;
    telefono: string;
    direccion: string;
    nota?: string;
    ubicacion?: { lat: number; lng: number } | null;
  };
  delivery: {
    date: string;
    dateLabel: string;
    timeRange: string;
  };
  items: TelegramOrderItem[];
  totals: {
    distinct: number;
    totalQty: number;
    total: number;
    subtotal: number;
    discountTotal: number;
  };
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDiscount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",");
}

function buildLegacyLine(item: TelegramOrderItem) {
  const codigoOriginal = cleanText(item.codigo);
  const codigoLower = codigoOriginal.toLowerCase();
  const nombre = cleanText(item.nombre);
  const presentacion = Math.max(1, Math.trunc(Number(item.unidadesPorCaja || 0)) || 1);
  const cantidad = Math.max(0, Math.trunc(Number(item.cantidadUnidades || 0)));
  const descuento = Number(item.descuentoPct || 0);
  const cajasDeclaradas = Math.max(0, Math.trunc(Number(item.cantidadCajas || 0)));
  const cajas = presentacion > 1 ? Math.max(cajasDeclaradas, Math.floor(cantidad / presentacion)) : 0;
  const unidades = presentacion > 1 ? Math.max(0, cantidad - cajas * presentacion) : cantidad;

  const esPromo = codigoLower.startsWith("p");
  const codigosSpeed = new Set(["1", "1/1", "2", "2/2"]);
  const esSpeed = codigosSpeed.has(codigoOriginal);
  const etiquetaUnid = esPromo ? "promo" : "unid.";

  let linea = "";

  if (esPromo) {
    if (presentacion === 1) {
      const sufijo = cantidad > 1 ? "Promos" : "Promo";
      linea = `${cantidad} ${sufijo} ${nombre}`;
    } else if (cantidad >= presentacion && cantidad % presentacion === 0) {
      const cajasPromo = cantidad / presentacion;
      const sufijo = cajasPromo > 1 ? "cajas" : "caja";
      linea = `${cajasPromo} ${sufijo} en Promo (${cantidad} unid.) ${nombre}`;
    } else {
      linea = `${cantidad} unid. en Promo ${nombre}`;
    }
  } else if (presentacion === 1) {
    linea = `${String(cantidad).padStart(2, "0")} ${etiquetaUnid} ${nombre}`;
  } else {
    const partes: string[] = [];
    if (cajas >= 1) {
      const sufijo =
        cajas > 1
          ? esSpeed
            ? "packs"
            : "cajas"
          : esSpeed
            ? "pack"
            : "caja";
      partes.push(`${cajas} ${sufijo}`);
    }
    if (unidades > 0) {
      partes.push(`${unidades} ${etiquetaUnid}`);
    }
    linea =
      cajas >= 1
        ? `${partes.join(" y ")} (${cantidad} unid.) ${nombre}`
        : `${partes.join(" y ")} ${nombre}`;
  }

  if (codigoLower.startsWith("h") && codigoOriginal) {
    linea += ` (${codigoOriginal})`;
  }

  const discountText = formatDiscount(descuento);
  if (discountText) {
    linea += ` <i>- (${escapeHtml(discountText)}%)</i>`;
  }

  return linea;
}

export function buildTelegramOrderMessage(payload: TelegramOrderPayload) {
  const cliente = cleanText(payload.cliente?.nombre);
  const direccion = cleanText(payload.cliente?.direccion);
  const telefono = cleanText(payload.cliente?.telefono);
  const nota = cleanText(payload.cliente?.nota);
  const deliveryDate = cleanText(payload.delivery?.dateLabel);
  const deliveryTimeRange = cleanText(payload.delivery?.timeRange);
  const lat = Number(payload.cliente?.ubicacion?.lat);
  const lng = Number(payload.cliente?.ubicacion?.lng);
  const mapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : "";

  const lineasJoma: string[] = [];
  const lineasJonico: string[] = [];

  for (const item of payload.items || []) {
    const linea = buildLegacyLine(item);
    if (!linea) continue;
    const codigo = cleanText(item.codigo).toLowerCase();
    if (codigo.startsWith("h")) {
      lineasJonico.push(`- ${linea}`);
    } else {
      lineasJoma.push(`- ${linea}`);
    }
  }

  let mensaje = `<b>${escapeHtml(cliente)}</b>\n${escapeHtml(direccion)}`;
  if (deliveryDate && deliveryTimeRange) {
    mensaje += `\n📅 <b>Entrega:</b> ${escapeHtml(deliveryDate)}, de ${escapeHtml(deliveryTimeRange)}`;
  }

  if (lineasJoma.length || lineasJonico.length) {
    mensaje += "\n\n";
  }

  if (lineasJoma.length) {
    mensaje += `${lineasJoma.join("\n")}\n`;
  }

  if (lineasJonico.length) {
    mensaje += `\n<i>(Prod. de JONICO)</i>\n${lineasJonico.join("\n")}\n`;
  }

  if (nota) {
    mensaje += `\n📝 Nota: ${escapeHtml(nota)}\n`;
  }

  if (telefono) {
    mensaje += `\n📞 ${escapeHtml(telefono)}`;
  }
  if (mapsUrl) {
    mensaje += `\n📍 <a href="${mapsUrl}">Abrir ubicación en Google Maps</a>`;
  }

  return mensaje.trim();
}

export async function notifyTelegramOrder(payload: TelegramOrderPayload) {
  const response = await fetch("/api/telegram/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }))) as {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || data.ok !== true) {
    if (data.error === "TELEGRAM_NOT_CONFIGURED") {
      throw new Error("El envío por Telegram todavía no está configurado.");
    }
    throw new Error(data.error || "No se pudo enviar el aviso por Telegram.");
  }

  return data;
}
