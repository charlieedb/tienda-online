function clean(value) { return String(value ?? "").trim(); }
function escapeHtml(value) { return clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function orderLine(item) {
  const code = clean(item.codigo);
  const name = clean(item.nombre);
  const units = Math.max(0, Math.trunc(Number(item.cantidadUnidades) || 0));
  const boxes = Math.max(0, Math.trunc(Number(item.cantidadCajas) || 0));
  const unitsPerBox = Math.max(0, Math.trunc(Number(item.unidadesPorCaja) || 0));
  if (!name) return "";
  let quantity = `${units} unid.`;
  if (boxes > 0) quantity = `${boxes} ${boxes === 1 ? "caja" : "cajas"}${unitsPerBox ? ` (${units} unid.)` : ""}`;
  if (code.toLowerCase().startsWith("p")) quantity = `${Math.max(1, boxes || units)} ${boxes + units === 1 ? "promo" : "promos"}`;
  const discount = Number(item.descuentoPct) || 0;
  const discountText = discount > 0 ? ` <i>− ${escapeHtml(Number.isInteger(discount) ? discount : discount.toFixed(2))}% dto.</i>` : "";
  return `- ${escapeHtml(quantity)} ${escapeHtml(name)}${code.toLowerCase().startsWith("h") ? ` (${escapeHtml(code)})` : ""}${discountText}`;
}

function buildMessage(payload) {
  const client = payload?.cliente || {};
  const regular = [];
  const jonico = [];
  for (const item of Array.isArray(payload?.items) ? payload.items : []) {
    const line = orderLine(item);
    if (!line) continue;
    (clean(item.codigo).toLowerCase().startsWith("h") ? jonico : regular).push(line);
  }
  let message = `<b>${escapeHtml(client.nombre)}</b>\n${escapeHtml(client.direccion)}`;
  const delivery = payload?.delivery || {};
  const timeRange = clean(delivery.timeRange || delivery.time);
  if (clean(delivery.dateLabel) && timeRange) {
    message += `\n📅 <b>Entrega:</b> ${escapeHtml(delivery.dateLabel)}, de ${escapeHtml(timeRange)}`;
  }
  if (regular.length) message += `\n\n${regular.join("\n")}`;
  if (jonico.length) message += `\n\n<i>(Prod. de JONICO)</i>\n${jonico.join("\n")}`;
  if (clean(client.nota)) message += `\n\n📝 Nota: ${escapeHtml(client.nota)}`;
  if (clean(client.telefono)) message += `\n📞 ${escapeHtml(client.telefono)}`;
  const lat = Number(client?.ubicacion?.lat);
  const lng = Number(client?.ubicacion?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    message += `\n📍 <a href="https://www.google.com/maps?q=${lat},${lng}">Abrir ubicación en Google Maps</a>`;
  }
  return message;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = clean(process.env.TELEGRAM_CHAT_ID);
  if (!token || !chatId) return response.status(503).json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" });
  let payload = request.body;
  if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return response.status(400).json({ ok: false, error: "INVALID_JSON" }); } }
  if (!payload?.pedido?.id || !clean(payload?.cliente?.nombre) || !clean(payload?.cliente?.direccion) || !Array.isArray(payload?.items)) {
    return response.status(400).json({ ok: false, error: "INVALID_ORDER_PAYLOAD" });
  }
  try {
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: buildMessage(payload), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await telegram.json().catch(() => null);
    if (!telegram.ok || result?.ok !== true) return response.status(502).json({ ok: false, error: result?.description || "TELEGRAM_SEND_FAILED" });
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(502).json({ ok: false, error: error instanceof Error ? error.message : "TELEGRAM_SEND_FAILED" });
  }
}
