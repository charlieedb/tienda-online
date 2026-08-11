import { Fragment, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Product } from "@/catalog/types";
import {
  DEFAULT_DELIVERY_SCHEDULE,
  getFeaturedProductsConfig,
  saveDeliveryScheduleConfig,
  saveFeaturedProductIds,
} from "@/lib/featuredProducts";
import { getDiscountCodes, getDiscountCodeUsages, normalizeDiscountCode, saveDiscountCodes, type DiscountCode, type DiscountCodeUsage } from "@/lib/discountCodes";

const DELIVERY_DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

function normalize(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatUsageDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date) : "Sin fecha";
}

export function AdminStoreConfigPanel({ user }: { user: User }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deliverySchedule, setDeliverySchedule] = useState(DEFAULT_DELIVERY_SCHEDULE);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPercentage, setNewPercentage] = useState(5);
  const [newValidFrom, setNewValidFrom] = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");
  const [newUsageLimit, setNewUsageLimit] = useState(0);
  const [discountUsages, setDiscountUsages] = useState<DiscountCodeUsage[]>([]);
  const [expandedCode, setExpandedCode] = useState("");
  const [loadingUsages, setLoadingUsages] = useState(false);
  const [savingCodes, setSavingCodes] = useState(false);
  const [codesMessage, setCodesMessage] = useState("");

  useEffect(() => {
    let active = true;
    const catalog = createRemoteCatalog();
    const loadRealProducts = async () => {
      const manifest = await catalog.getManifest();
      const groups = await Promise.all(manifest.categories.map((category) => catalog.getCategoryProducts(category.id)));
      return groups.flat();
    };
    Promise.all([loadRealProducts(), getFeaturedProductsConfig({ refresh: true }), getDiscountCodes(), getDiscountCodeUsages().catch(() => [])])
      .then(([catalog, config, codes, usages]) => {
        if (!active) return;
        setProducts(catalog);
        setSelectedIds(config.ids);
        setDeliverySchedule(config.deliverySchedule);
        setDiscountCodes(codes);
        setDiscountUsages(usages);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la configuración.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedProducts = selectedIds.map((id) => productsById.get(id)).filter((product): product is Product => Boolean(product));
  const query = normalize(search);
  const results = query.length < 2 ? [] : products
    .filter((product) => {
      const haystack = normalize([product.id, product.name, product.category, product.brand].filter(Boolean).join(" "));
      return query.split(/\s+/).every((term) => haystack.includes(term));
    })
    .slice(0, 80);

  const toggle = (id: string) => {
    setMessage("");
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const move = (id: string, direction: -1 | 1) => {
    setMessage("");
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await saveFeaturedProductIds(selectedIds, user.email || user.uid);
      setMessage("Destacados guardados. La tienda los mostrará en este orden.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar los destacados.");
    } finally {
      setSaving(false);
    }
  };

  const saveDelivery = async () => {
    setSavingDelivery(true);
    setDeliveryMessage("");
    try {
      const saved = await saveDeliveryScheduleConfig(deliverySchedule, user.email || user.uid);
      setDeliverySchedule(saved);
      setDeliveryMessage("Días y horarios de entrega guardados.");
    } catch (error) {
      setDeliveryMessage(error instanceof Error ? error.message : "No se pudo guardar la entrega.");
    } finally {
      setSavingDelivery(false);
    }
  };

  const addDiscountCode = () => {
    const code = normalizeDiscountCode(newCode);
    setCodesMessage("");
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      setCodesMessage("Usá entre 3 y 24 letras, números, guion o guion bajo.");
      return;
    }
    if (discountCodes.some((item) => item.code === code)) {
      setCodesMessage("Ese código ya existe.");
      return;
    }
    if (!Number.isFinite(newPercentage) || newPercentage <= 0 || newPercentage > 100) {
      setCodesMessage("El porcentaje debe ser mayor a 0 y no superar el 100%.");
      return;
    }
    if (newValidFrom && newValidUntil && newValidUntil < newValidFrom) {
      setCodesMessage("La fecha de finalización no puede ser anterior al inicio.");
      return;
    }
    setDiscountCodes((current) => [...current, {
      code,
      percentage: Math.round(newPercentage * 100) / 100,
      active: true,
      validFrom: newValidFrom,
      validUntil: newValidUntil,
      usageLimit: Math.max(0, Math.trunc(newUsageLimit || 0)),
      usageCount: 0,
    }]);
    setNewCode("");
    setNewPercentage(5);
    setNewValidFrom("");
    setNewValidUntil("");
    setNewUsageLimit(0);
  };

  const refreshDiscountData = async () => {
    setLoadingUsages(true);
    setCodesMessage("");
    try {
      const [codes, usages] = await Promise.all([getDiscountCodes(), getDiscountCodeUsages()]);
      setDiscountCodes(codes);
      setDiscountUsages(usages);
      setCodesMessage("Listado actualizado.");
    } catch (error) {
      setCodesMessage(error instanceof Error ? error.message : "No se pudo actualizar el listado.");
    } finally {
      setLoadingUsages(false);
    }
  };

  const persistDiscountCodes = async () => {
    setSavingCodes(true);
    setCodesMessage("");
    try {
      const saved = await saveDiscountCodes(discountCodes, user.email || user.uid);
      setDiscountCodes(saved);
      setCodesMessage("Códigos de descuento guardados.");
    } catch (error) {
      setCodesMessage(error instanceof Error ? error.message : "No se pudieron guardar los códigos.");
    } finally {
      setSavingCodes(false);
    }
  };

  return <div className="admin-content-box admin-store-config">
    <section className="admin-card admin-discount-config">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Códigos de descuento</h1>
          <p>Definí el porcentaje, la vigencia y el límite de usos. El descuento se aplica solo a productos sin promociones previas.</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => void refreshDiscountData()} disabled={loadingUsages}>{loadingUsages ? "Actualizando..." : "Actualizar listado"}</button>
      </div>
      <div className="admin-card__body">
        <div className="admin-discount-create">
          <label><span>Código</span><input className="admin-input" value={newCode} onChange={(event) => setNewCode(normalizeDiscountCode(event.target.value))} maxLength={24} placeholder="EJ: CLIENTE10"/></label>
          <label><span>Porcentaje</span><div className="admin-discount-number"><input className="admin-input" type="number" min="0.01" max="100" step="0.01" value={newPercentage} onChange={(event) => setNewPercentage(Number(event.target.value))}/><b>%</b></div></label>
          <label><span>Válido desde <em>Opcional</em></span><input className="admin-input" type="date" value={newValidFrom} onChange={(event) => setNewValidFrom(event.target.value)}/></label>
          <label><span>Válido hasta <em>Opcional</em></span><input className="admin-input" type="date" value={newValidUntil} min={newValidFrom || undefined} onChange={(event) => setNewValidUntil(event.target.value)}/></label>
          <label><span>Límite de usos <em>0 = ilimitado</em></span><input className="admin-input" type="number" min="0" step="1" value={newUsageLimit} onChange={(event) => setNewUsageLimit(Math.max(0, Number(event.target.value)))}/></label>
          <button type="button" className="btn primary" onClick={addDiscountCode}>+ Agregar código</button>
        </div>
        <div className="admin-discount-list-wrap">
          <table className="admin-discount-table">
            <thead><tr><th>Código</th><th>Descuento</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{discountCodes.map((item) => {
              const usages = discountUsages.filter((usage) => usage.code === item.code);
              const exhausted = item.usageLimit > 0 && item.usageCount >= item.usageLimit;
              return <Fragment key={item.code}>
                <tr>
                  <td><strong>{item.code}</strong></td>
                  <td>{item.percentage}%</td>
                  <td><span>{item.validFrom || "Sin inicio"}</span><small>hasta {item.validUntil || "sin vencimiento"}</small></td>
                  <td><button type="button" className="admin-discount-usage-button" onClick={() => setExpandedCode((current) => current === item.code ? "" : item.code)}>{item.usageCount}{item.usageLimit > 0 ? ` / ${item.usageLimit}` : " / ∞"}<small>Ver clientes</small></button></td>
                  <td><span className={`admin-discount-status ${item.active && !exhausted ? "is-active" : "is-inactive"}`}>{exhausted ? "Agotado" : item.active ? "Activo" : "Inactivo"}</span></td>
                  <td><div className="admin-discount-row-actions"><button type="button" className="btn ghost" onClick={() => setDiscountCodes((current) => current.map((code) => code.code === item.code ? { ...code, active: !code.active } : code))}>{item.active ? "Desactivar" : "Activar"}</button><button type="button" className="btn ofertas-danger" onClick={() => setDiscountCodes((current) => current.filter((code) => code.code !== item.code))}>Eliminar</button></div></td>
                </tr>
                {expandedCode === item.code ? <tr className="admin-discount-usage-row"><td colSpan={6}>{usages.length ? <div className="admin-discount-usages">{usages.map((usage) => <article key={usage.id}><div><strong>{usage.customerName || "Cliente sin nombre"}</strong><span>{usage.customerEmail || usage.customerPhone || usage.customerUid}</span></div><div><span>{formatUsageDate(usage.usedAtIso)}</span><small>Pedido {usage.orderId}</small></div><b>−{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(usage.discountAmount)}</b></article>)}</div> : <p className="admin-discount-empty">Todavía no hay usos registrados para este código.</p>}</td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table>
          {!discountCodes.length ? <p className="admin-discount-empty">Todavía no creaste códigos.</p> : null}
        </div>
        <div className="admin-discount-actions"><button type="button" className="btn success" onClick={() => void persistDiscountCodes()} disabled={savingCodes}>{savingCodes ? "Guardando..." : "Guardar códigos"}</button></div>
        {codesMessage ? <div className="admin-users-message" role="status">{codesMessage}</div> : null}
      </div>
    </section>
    <section className="admin-card admin-delivery-config">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Días y horarios de entrega</h1>
          <p>El cliente podrá elegir desde el día siguiente. Los domingos siempre quedan excluidos.</p>
        </div>
      </div>
      <div className="admin-card__body">
        <div className="admin-delivery-days" role="group" aria-label="Días con reparto">
          {DELIVERY_DAYS.map((day) => {
            const checked = deliverySchedule.weekdays.includes(day.value);
            return <label className={checked ? "is-active" : ""} key={day.value}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setDeliverySchedule((current) => ({
                  ...current,
                  weekdays: checked
                    ? current.weekdays.filter((value) => value !== day.value)
                    : [...current.weekdays, day.value].sort((a, b) => a - b),
                }))}
              />
              <span>{day.label}</span>
            </label>;
          })}
          <label className="is-disabled">
            <input type="checkbox" checked={false} disabled/>
            <span>Domingo</span>
          </label>
        </div>
        <div className="admin-delivery-ranges">
          {deliverySchedule.timeRanges.map((range, index) => (
            <div className="admin-delivery-range" key={index}>
              <strong>Franja {index + 1}</strong>
              <label>
                <span>Desde</span>
                <input className="admin-input" type="time" value={range.startTime} onChange={(event) => setDeliverySchedule((current) => ({
                  ...current,
                  timeRanges: current.timeRanges.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                }))}/>
              </label>
              <label>
                <span>Hasta</span>
                <input className="admin-input" type="time" value={range.endTime} onChange={(event) => setDeliverySchedule((current) => ({
                  ...current,
                  timeRanges: current.timeRanges.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                }))}/>
              </label>
            </div>
          ))}
          <button type="button" className="btn success" onClick={() => void saveDelivery()} disabled={savingDelivery || !deliverySchedule.weekdays.length || deliverySchedule.timeRanges.some((range) => !range.startTime || !range.endTime || range.startTime >= range.endTime)}>
            {savingDelivery ? "Guardando..." : "Guardar entregas"}
          </button>
        </div>
        {deliveryMessage ? <div className="admin-users-message" role="status">{deliveryMessage}</div> : null}
      </div>
    </section>
    <section className="admin-card">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Configuración de la tienda</h1>
          <p>Elegí los artículos que aparecen en Destacados. Esto no modifica precios ni ofertas.</p>
        </div>
      </div>
      <div className="admin-card__body admin-featured-layout">
        <div className="admin-featured-selected">
          <div className="admin-featured-heading">
            <div>
              <h2>Destacados seleccionados</h2>
              <span>{selectedIds.length} artículos</span>
            </div>
            <button type="button" className="btn success" onClick={() => void save()} disabled={saving || loading}>
              {saving ? "Guardando..." : "Guardar destacados"}
            </button>
          </div>
          {message ? <div className="admin-users-message" role="status">{message}</div> : null}
          <div className="admin-featured-selection-list">
            {selectedProducts.map((product, index) => <article key={product.id}>
              <b>{index + 1}</b>
              <div><strong>{product.name}</strong><span>{product.id} · {product.category || product.brand || "Sin categoría"}</span></div>
              <div className="admin-featured-order-actions">
                <button type="button" onClick={() => move(product.id, -1)} disabled={index === 0} aria-label={`Subir ${product.name}`}>↑</button>
                <button type="button" onClick={() => move(product.id, 1)} disabled={index === selectedProducts.length - 1} aria-label={`Bajar ${product.name}`}>↓</button>
                <button type="button" className="is-remove" onClick={() => toggle(product.id)}>Quitar</button>
              </div>
            </article>)}
            {!loading && !selectedProducts.length ? <p>Todavía no seleccionaste artículos.</p> : null}
          </div>
        </div>

        <div className="admin-featured-search">
          <h2>Buscar artículos</h2>
          <input className="admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, nombre o categoría"/>
          <div className="admin-featured-results">
            {loading ? <p>Cargando catálogo...</p> : query.length < 2 ? <p>Escribí al menos dos letras para buscar.</p> : results.map((product) => {
              const selected = selectedIds.includes(product.id);
              return <button type="button" className={selected ? "is-selected" : ""} onClick={() => toggle(product.id)} key={product.id}>
                <div><strong>{product.name}</strong><span>{product.id} · {product.category || product.brand || "Sin categoría"}</span></div>
                <b>{selected ? "Seleccionado" : "Agregar"}</b>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
  </div>;
}
