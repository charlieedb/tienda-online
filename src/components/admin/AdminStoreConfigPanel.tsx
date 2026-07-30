import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Product } from "@/catalog/types";
import {
  DEFAULT_DELIVERY_SCHEDULE,
  getFeaturedProductsConfig,
  saveDeliveryScheduleConfig,
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

  return <div className="admin-content-box admin-store-config">
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
        <div className="admin-delivery-times">
          <label>
            <span>Desde</span>
            <input className="admin-input" type="time" value={deliverySchedule.startTime} onChange={(event) => setDeliverySchedule((current) => ({ ...current, startTime: event.target.value }))}/>
          </label>
          <label>
            <span>Hasta</span>
            <input className="admin-input" type="time" value={deliverySchedule.endTime} onChange={(event) => setDeliverySchedule((current) => ({ ...current, endTime: event.target.value }))}/>
          </label>
          <button type="button" className="btn success" onClick={() => void saveDelivery()} disabled={savingDelivery || !deliverySchedule.weekdays.length || deliverySchedule.startTime >= deliverySchedule.endTime}>
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
