import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Product } from "@/catalog/types";
import {
  DEFAULT_DELIVERY_SCHEDULE,
  DEFAULT_CHECKOUT_SETTINGS,
  getFeaturedProductsConfig,
  saveDeliveryScheduleConfig,
  saveCheckoutSettingsConfig,
  saveFeaturedProductIds,
} from "@/lib/featuredProducts";

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
  const [checkoutSettings, setCheckoutSettings] = useState(DEFAULT_CHECKOUT_SETTINGS);
  const [savingCheckoutSettings, setSavingCheckoutSettings] = useState(false);
  const [checkoutSettingsMessage, setCheckoutSettingsMessage] = useState("");

  useEffect(() => {
    let active = true;
    const catalog = createRemoteCatalog();
    const loadRealProducts = async () => {
      const manifest = await catalog.getManifest();
      const groups = await Promise.all(manifest.categories.map((category) => catalog.getCategoryProducts(category.id)));
      return groups.flat();
    };
    Promise.all([loadRealProducts(), getFeaturedProductsConfig({ refresh: true })])
      .then(([catalog, config]) => {
        if (!active) return;
        setProducts(catalog);
        setSelectedIds(config.ids);
        setDeliverySchedule(config.deliverySchedule);
        setCheckoutSettings(config.checkoutSettings);
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

  const saveCheckoutSettings = async () => {
    setSavingCheckoutSettings(true);
    setCheckoutSettingsMessage("");
    try {
      const saved = await saveCheckoutSettingsConfig(checkoutSettings, user.email || user.uid);
      setCheckoutSettings(saved);
      setCheckoutSettingsMessage("Costos y mínimo de compra guardados.");
    } catch (error) {
      setCheckoutSettingsMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración de compra.");
    } finally {
      setSavingCheckoutSettings(false);
    }
  };

  return <div className="admin-content-box admin-store-config">
    <section className="admin-card admin-checkout-config">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Compra y envío</h1>
          <p>Configurá el mínimo del pedido, el costo de referencia del envío y si la tienda lo bonifica.</p>
        </div>
      </div>
      <div className="admin-card__body admin-checkout-settings">
        <label><span>Mínimo de compra</span><div className="admin-money-input"><b>$</b><input className="admin-input" type="number" min="0" step="100" value={checkoutSettings.minimumOrder} onChange={(event) => setCheckoutSettings((current) => ({ ...current, minimumOrder: Math.max(0, Number(event.target.value)) }))}/></div></label>
        <label><span>Costo de envío</span><div className="admin-money-input"><b>$</b><input className="admin-input" type="number" min="0" step="50" value={checkoutSettings.shippingCost} onChange={(event) => setCheckoutSettings((current) => ({ ...current, shippingCost: Math.max(0, Number(event.target.value)) }))}/></div></label>
        <label className="admin-free-shipping-toggle"><input type="checkbox" checked={checkoutSettings.freeShipping} onChange={(event) => setCheckoutSettings((current) => ({ ...current, freeShipping: event.target.checked }))}/><span><strong>Envío gratis</strong><small>El costo se muestra tachado y no se suma al total.</small></span></label>
        <button type="button" className="btn success" onClick={() => void saveCheckoutSettings()} disabled={savingCheckoutSettings}>{savingCheckoutSettings ? "Guardando..." : "Guardar compra y envío"}</button>
        {checkoutSettingsMessage ? <div className="admin-users-message" role="status">{checkoutSettingsMessage}</div> : null}
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
    <section className="admin-card admin-featured-config">
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
