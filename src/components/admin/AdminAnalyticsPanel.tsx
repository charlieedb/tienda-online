import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

type PromotionPerformance = {
  key: string; campaignId: string; campaignName: string; creativeName: string; creativeSlot: string;
  itemId: string; itemName: string; advertiser: string; type: "banner" | "product";
  impressions: number; clicks: number; purchases: number; revenue: number; ctr: number; conversion: number;
};

type AnalyticsResponse = {
  range: { startDate: string; endDate: string }; updatedAt: string; cached: boolean;
  overview: { users: number; sessions: number; views: number; newUsers: number; engagedSessions: number; addToCarts: number; checkouts: number; purchases: number; revenue: number; conversion: number; averageOrderValue: number };
  promotions: PromotionPerformance[];
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("es-AR");
const percent = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 2 });

function isoDaysAgo(days: number) { return new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10); }
function promotionLabel(item: PromotionPerformance) { return item.creativeName || item.itemName || item.campaignName || item.campaignId; }

export function AdminAnalyticsPanel({ user }: { user: User }) {
  const [preset, setPreset] = useState<"7" | "30" | "90" | "custom">("30");
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = useMemo(() => ({ start: preset === "custom" ? start : isoDaysAgo(Number(preset)), end: preset === "custom" ? end : new Date().toISOString().slice(0, 10) }), [end, preset, start]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void user.getIdToken().then((token) => fetch(`/api/admin/analytics?start=${query.start}&end=${query.end}`, { headers: { Authorization: `Bearer ${token}` } })).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "No se pudieron cargar las métricas.");
      if (active) setData(result);
    }).catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar las métricas."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query.end, query.start, user]);

  const exportCsv = () => {
    if (!data) return;
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Tipo", "Promoción", "ID producto", "Campaña", "ID campaña", "Anunciante", "Ubicación", "Impresiones", "Clics", "CTR", "Compras", "Ingresos", "Conversión"],
      ...data.promotions.map((item) => [item.type === "banner" ? "Banner" : "Producto", promotionLabel(item), item.itemId, item.campaignName, item.campaignId, item.advertiser, item.creativeSlot, item.impressions, item.clicks, item.ctr, item.purchases, item.revenue, item.conversion]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `rendimiento-promociones-${data.range.startDate}-${data.range.endDate}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const metrics = data ? [
    ["Usuarios", integer.format(data.overview.users)], ["Sesiones", integer.format(data.overview.sessions)], ["Vistas", integer.format(data.overview.views)], ["Usuarios nuevos", integer.format(data.overview.newUsers)],
    ["Agregados al carrito", integer.format(data.overview.addToCarts)], ["Checkouts", integer.format(data.overview.checkouts)], ["Compras", integer.format(data.overview.purchases)], ["Conversión", percent.format(data.overview.conversion)],
    ["Ingresos", money.format(data.overview.revenue)], ["Ticket promedio", money.format(data.overview.averageOrderValue)], ["Sesiones con interacción", integer.format(data.overview.engagedSessions)],
  ] : [];

  return <div className="admin-content-box admin-analytics-panel"><section className="admin-card">
    <div className="admin-card__head"><div><div className="admin-kicker">Google Analytics 4</div><h1 className="admin-title">Reportes y promociones</h1><p>Compará el interés y las compras generadas por cada banner o producto patrocinado.</p></div><button type="button" className="btn ghost" disabled={!data?.promotions?.length} onClick={exportCsv}>Exportar CSV</button></div>
    <div className="admin-card__body">
      <div className="admin-report-filters"><select className="admin-input" value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="custom">Rango personalizado</option></select>{preset === "custom" ? <><input className="admin-input" type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)}/><input className="admin-input" type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)}/></> : null}</div>
      {loading ? <div className="admin-carousel-empty">Consultando Google Analytics…</div> : null}
      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {data && !loading ? <><div className="grid gap-3 md:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-[28px] border border-white/60 bg-white/78 px-4 py-4" key={label}><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">{label}</div><div className="mt-2 text-2xl font-semibold text-[#1d2538]">{value}</div></div>)}</div><div className="admin-report-updated">Actualizado {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.updatedAt))}{data.cached ? " · caché de 5 minutos" : ""}</div><div className="ofertas-list-wrap admin-analytics-table-wrap mt-5"><table className="productos-table ofertas-table admin-analytics-table"><thead><tr><th>Promoción</th><th>Tipo y campaña</th><th>Impresiones</th><th>Clics</th><th>CTR</th><th>Compras</th><th>Ingresos</th><th>Conversión</th></tr></thead><tbody>{(data.promotions || []).map((item) => <tr key={item.key}><td><strong>{promotionLabel(item)}</strong><small>{item.type === "product" && item.itemId ? `Producto ${item.itemId}` : item.creativeSlot || "Banner"}</small></td><td><strong>{item.type === "banner" ? "Banner" : "Producto patrocinado"}</strong><small>{item.campaignName || item.campaignId}{item.advertiser ? ` · ${item.advertiser}` : ""}</small></td><td>{integer.format(item.impressions)}</td><td>{integer.format(item.clicks)}</td><td>{percent.format(item.ctr)}</td><td>{integer.format(item.purchases)}</td><td>{money.format(item.revenue)}</td><td>{percent.format(item.conversion)}</td></tr>)}</tbody></table>{!data.promotions?.length ? <div className="admin-carousel-empty"><strong>Todavía no hay promociones medidas</strong><span>Los banners y productos aparecerán por separado cuando registren impresiones.</span></div> : null}</div></> : null}
    </div>
  </section></div>;
}
