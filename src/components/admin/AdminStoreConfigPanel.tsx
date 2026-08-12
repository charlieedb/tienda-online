import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { createNotificationCampaign, notificationPlainText, sanitizeNotificationHtml, type NotificationAction, type NotificationStatus } from "@/lib/notifications";

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
  const notificationEditorRef = useRef<HTMLDivElement | null>(null);
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
  const [newAudience, setNewAudience] = useState<"all" | "business">("all");
  const [discountUsages, setDiscountUsages] = useState<DiscountCodeUsage[]>([]);
  const [expandedCode, setExpandedCode] = useState("");
  const [loadingUsages, setLoadingUsages] = useState(false);
  const [savingCodes, setSavingCodes] = useState(false);
  const [codesMessage, setCodesMessage] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationAudience, setNotificationAudience] = useState<"all" | "business" | "consumer">("all");
  const [notificationAction, setNotificationAction] = useState<NotificationAction>("none");
  const [notificationTarget, setNotificationTarget] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("draft");
  const [notificationScheduledAt, setNotificationScheduledAt] = useState("");
  const [notificationExpiresAt, setNotificationExpiresAt] = useState("");
  const [notificationCouponPercentage, setNotificationCouponPercentage] = useState(10);
  const [notificationCouponUsageLimit, setNotificationCouponUsageLimit] = useState(0);
  const [notificationCouponPerUserLimit, setNotificationCouponPerUserLimit] = useState(1);
  const [savingNotification, setSavingNotification] = useState(false);

  useEffect(() => {
    if (!notificationBody && notificationEditorRef.current?.innerHTML) notificationEditorRef.current.innerHTML = "";
  }, [notificationBody]);

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
      audience: newAudience,
    }]);
    setNewCode("");
    setNewPercentage(5);
    setNewValidFrom("");
    setNewValidUntil("");
    setNewUsageLimit(0);
    setNewAudience("all");
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

  const saveNotificationCampaign = async () => {
    setNotificationMessage("");
    if (!notificationTitle.trim() || !notificationPlainText(notificationBody)) {
      setNotificationMessage("Completá el título y el mensaje para guardar el borrador.");
      return;
    }
    if ((notificationAction === "coupon" || notificationAction === "product" || notificationAction === "search") && !notificationTarget.trim()) {
      setNotificationMessage("Elegí el cupón o producto asociado a la acción.");
      return;
    }
    setSavingNotification(true);
    try {
      const campaign = await createNotificationCampaign({
        title: notificationTitle.trim(), body: sanitizeNotificationHtml(notificationBody), bodyText: notificationPlainText(notificationBody), audience: notificationAudience,
        action: notificationAction, target: notificationTarget.trim(), status: notificationStatus,
        scheduledAt: notificationScheduledAt ? new Date(notificationScheduledAt).toISOString() : "",
        expiresAt: notificationExpiresAt ? new Date(`${notificationExpiresAt}T23:59:59`).toISOString() : "",
      }, user.email || user.uid);
      if (notificationAction === "coupon") {
        const code = normalizeDiscountCode(notificationTarget);
        const nextCodes = discountCodes.filter((item) => item.code !== code).concat({
          code, percentage: notificationCouponPercentage, active: true, validFrom: "",
          validUntil: notificationExpiresAt, usageLimit: notificationCouponUsageLimit, usageCount: 0,
          perUserLimit: notificationCouponPerUserLimit, audience: notificationAudience === "business" ? "business" as const : "all" as const,
          source: "notification" as const, campaignId: campaign.id,
        });
        setDiscountCodes(await saveDiscountCodes(nextCodes, user.email || user.uid));
      }
      setNotificationMessage(notificationStatus === "draft" ? "Campaña guardada como borrador." : notificationStatus === "scheduled" ? "Campaña programada." : "Campaña publicada en la campana de la tienda.");
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "No se pudo guardar la campaña.");
    } finally {
      setSavingNotification(false);
    }
  };

  return <div className="admin-content-box admin-store-config">
    <section className="admin-card admin-notification-config">
      <div className="admin-card__head">
        <div className="admin-headline">
          <h1 className="admin-title">Notificaciones</h1>
          <p>Prepará el mensaje, definí quién lo recibe y qué debe ocurrir cuando el usuario lo toca.</p>
        </div>
        <span className="admin-module-state">En preparación</span>
      </div>
      <div className="admin-card__body admin-notification-layout">
        <div className="admin-notification-form">
          <label><span>Título</span><input className="admin-input" value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} maxLength={55} placeholder="Ej: Tenés un cupón disponible"/></label>
          <div className="admin-rich-field"><span>Mensaje</span><div className="admin-rich-toolbar" aria-label="Formato del mensaje"><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("bold"); }} aria-label="Negrita"><b>B</b></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("italic"); }} aria-label="Cursiva"><i>I</i></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("underline"); }} aria-label="Subrayado"><u>U</u></button><label className="admin-rich-color" title="Color del texto"><span>Color</span><input type="color" defaultValue="#c81b16" onInput={(event) => { notificationEditorRef.current?.focus(); document.execCommand("foreColor", false, event.currentTarget.value); setNotificationBody(sanitizeNotificationHtml(notificationEditorRef.current?.innerHTML || "")); }}/></label><div className="admin-rich-emojis">{["🎉", "🔥", "🎁", "🐔", "💸", "⭐"].map((emoji) => <button type="button" key={emoji} onMouseDown={(event) => { event.preventDefault(); document.execCommand("insertText", false, emoji); setNotificationBody(sanitizeNotificationHtml(notificationEditorRef.current?.innerHTML || "")); }} aria-label={`Insertar ${emoji}`}>{emoji}</button>)}</div></div><div ref={notificationEditorRef} className="admin-rich-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Contale al usuario qué beneficio recibió." onInput={(event) => setNotificationBody(sanitizeNotificationHtml(event.currentTarget.innerHTML))} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain").slice(0, 500)); }} /></div>
          <div className="admin-notification-row">
            <label><span>Destinatarios</span><select className="admin-input" value={notificationAudience} onChange={(event) => setNotificationAudience(event.target.value as "all" | "business" | "consumer")}><option value="all">Todos los clientes</option><option value="business">Solo comercios</option><option value="consumer">Consumidores finales</option></select></label>
            <label><span>Acción al tocar</span><select className="admin-input" value={notificationAction} onChange={(event) => { setNotificationAction(event.target.value as NotificationAction); setNotificationTarget(""); }}><option value="none">Solo abrir la notificación</option><option value="coupon">Agregar cupón al carrito</option><option value="search">Buscar en la tienda</option><option value="catalog">Abrir la tienda</option><option value="product">Abrir un producto</option><option value="cart">Abrir el carrito</option></select></label>
          </div>
          {notificationAction === "coupon" ? <div className="admin-notification-coupon"><label><span>Código del cupón</span><input className="admin-input" value={notificationTarget} onChange={(event) => setNotificationTarget(normalizeDiscountCode(event.target.value))} maxLength={24} placeholder="EJ: POLLOS10"/></label><label><span>Descuento</span><div className="admin-discount-number"><input className="admin-input" type="number" min="1" max="100" value={notificationCouponPercentage} onChange={(event) => setNotificationCouponPercentage(Number(event.target.value))}/><b>%</b></div></label><label><span>Usos totales <em>0 = ilimitado</em></span><input className="admin-input" type="number" min="0" value={notificationCouponUsageLimit} onChange={(event) => setNotificationCouponUsageLimit(Math.max(0, Number(event.target.value)))}/></label><label><span>Usos por usuario</span><input className="admin-input" type="number" min="1" value={notificationCouponPerUserLimit} onChange={(event) => setNotificationCouponPerUserLimit(Math.max(1, Number(event.target.value)))}/></label></div> : null}
          {notificationAction === "search" ? <label><span>Texto que se buscará</span><input className="admin-input" value={notificationTarget} onChange={(event) => setNotificationTarget(event.target.value)} placeholder="Ej: pollos"/></label> : null}
          {notificationAction === "product" ? <label><span>Producto a abrir</span><select className="admin-input" value={notificationTarget} onChange={(event) => setNotificationTarget(event.target.value)}><option value="">Seleccionar producto</option>{products.filter((product) => product.active !== false).slice(0, 250).map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label> : null}
          <div className="admin-notification-row"><label><span>Estado</span><select className="admin-input" value={notificationStatus} onChange={(event) => setNotificationStatus(event.target.value as NotificationStatus)}><option value="draft">Borrador</option><option value="scheduled">Programada</option><option value="sent">Publicar ahora</option><option value="paused">Pausada</option></select></label><label><span>Programar para</span><input className="admin-input" type="datetime-local" value={notificationScheduledAt} onChange={(event) => setNotificationScheduledAt(event.target.value)} disabled={notificationStatus !== "scheduled"}/></label></div>
          <label><span>Caducidad de la campaña y cupón <em>Opcional</em></span><input className="admin-input" type="date" value={notificationExpiresAt} onChange={(event) => setNotificationExpiresAt(event.target.value)}/></label>
          <div className="admin-notification-actions"><button type="button" className="btn ghost" onClick={() => { setNotificationTitle(""); setNotificationBody(""); setNotificationAction("none"); setNotificationTarget(""); setNotificationMessage(""); }}>Limpiar</button><button type="button" className="btn primary" onClick={() => void saveNotificationCampaign()} disabled={savingNotification}>{savingNotification ? "Guardando..." : notificationStatus === "sent" ? "Publicar campaña" : "Guardar campaña"}</button></div>
          {notificationMessage ? <div className="admin-users-message" role="status">{notificationMessage}</div> : null}
        </div>
        <aside className="admin-notification-preview" aria-label="Vista previa de la notificación">
          <span>Vista previa</span>
          <div className="admin-notification-preview__card"><div className="admin-notification-preview__icon">J</div><div><strong>{notificationTitle || "Título de la notificación"}</strong>{notificationBody ? <p dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(notificationBody) }} /> : <p>El mensaje que reciba el cliente aparecerá acá.</p>}<small>JOMA Express · ahora</small></div></div>
          <div className="admin-notification-action-summary"><span>Al tocar</span><strong>{notificationAction === "coupon" ? `Agregar cupón ${notificationTarget || "seleccionado"}` : notificationAction === "search" ? `Buscar “${notificationTarget || "..."}”` : notificationAction === "catalog" ? "Abrir la tienda" : notificationAction === "product" ? "Abrir el producto seleccionado" : notificationAction === "cart" ? "Abrir el carrito" : "Mostrar el mensaje"}</strong></div>
        </aside>
      </div>
    </section>
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
          <label><span>Disponible para</span><select className="admin-input" value={newAudience} onChange={(event) => setNewAudience(event.target.value === "business" ? "business" : "all")}><option value="all">Todos los clientes</option><option value="business">Solo comercios</option></select></label>
          <button type="button" className="btn primary" onClick={addDiscountCode}>+ Agregar código</button>
        </div>
        <div className="admin-discount-list-wrap">
          <table className="admin-discount-table">
            <thead><tr><th>Código</th><th>Origen</th><th>Descuento</th><th>Usuarios</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{discountCodes.map((item) => {
              const usages = discountUsages.filter((usage) => usage.code === item.code);
              const exhausted = item.usageLimit > 0 && item.usageCount >= item.usageLimit;
              return <Fragment key={item.code}>
                <tr>
                  <td><strong>{item.code}</strong></td>
                  <td><span className={`admin-discount-origin ${item.source === "notification" ? "is-notification" : ""}`}>{item.source === "notification" ? "Notificación" : "Manual"}</span></td>
                  <td>{item.source === "notification" ? <div className="admin-discount-inline-number"><input className="admin-input" type="number" min="1" max="100" value={item.percentage} onChange={(event) => setDiscountCodes((current) => current.map((code) => code.code === item.code ? { ...code, percentage: Number(event.target.value) } : code))}/><span>%</span></div> : `${item.percentage}%`}</td>
                  <td>{item.audience === "business" ? "Solo comercios" : "Todos"}{item.source === "notification" ? <label className="admin-discount-inline-limit"><span>Por usuario</span><input className="admin-input" type="number" min="1" value={item.perUserLimit || 1} onChange={(event) => setDiscountCodes((current) => current.map((code) => code.code === item.code ? { ...code, perUserLimit: Math.max(1, Number(event.target.value)) } : code))}/></label> : <small>{item.perUserLimit ? `${item.perUserLimit} por usuario` : "Sin límite individual"}</small>}</td>
                  <td>{item.source === "notification" ? <label className="admin-discount-inline-date"><span>Caduca</span><input className="admin-input" type="date" value={item.validUntil} onChange={(event) => setDiscountCodes((current) => current.map((code) => code.code === item.code ? { ...code, validUntil: event.target.value } : code))}/></label> : <><span>{item.validFrom || "Sin inicio"}</span><small>hasta {item.validUntil || "sin vencimiento"}</small></>}</td>
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
