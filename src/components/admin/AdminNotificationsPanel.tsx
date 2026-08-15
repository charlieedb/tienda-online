import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { createRemoteCatalog } from "@/catalog/remoteCatalog";
import type { Product } from "@/catalog/types";
import { getDiscountCodes, normalizeDiscountCode, saveDiscountCodes, type DiscountCode } from "@/lib/discountCodes";
import { createNotificationCampaign, deleteNotificationCampaign, finishNotificationCampaign, getNotificationCampaigns, notificationPlainText, sanitizeNotificationHtml, type NotificationAction, type NotificationCampaign, type NotificationStatus } from "@/lib/notifications";

const NOTIFICATION_EMOJIS = ["🎉", "🔥", "🎁", "🐔", "💸", "⭐", "🍕", "🍔", "🥩", "🍗", "🥤", "🍺", "🛒", "🏷️", "💳", "🚚", "📦", "✅", "⚡", "💥", "😍", "😋", "🤩", "🥳", "🙌", "📣", "🔔", "⏰", "📅", "❤️", "💙", "🧡", "👉", "👇", "✨", "🎊"];

function normalizeProductSearch(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatCampaignDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date) : "Sin fecha";
}

function statusLabel(status: NotificationStatus) {
  if (status === "sent") return "Publicada";
  if (status === "scheduled") return "Programada";
  if (status === "paused") return "Pausada";
  if (status === "finished") return "Finalizada";
  return "Borrador";
}

function audienceLabel(audience: NotificationCampaign["audience"]) {
  if (audience === "business") return "Comercios";
  if (audience === "consumer") return "Consumidores";
  return "Todos los clientes";
}

export function AdminNotificationsPanel({ user }: { user: User }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const productSearchRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "business" | "consumer">("all");
  const [action, setAction] = useState<NotificationAction>("none");
  const [target, setTarget] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productSuggestionsOpen, setProductSuggestionsOpen] = useState(false);
  const [status, setStatus] = useState<NotificationStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [couponPercentage, setCouponPercentage] = useState(10);
  const [couponUsageLimit, setCouponUsageLimit] = useState(0);
  const [couponPerUserLimit, setCouponPerUserLimit] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyCampaignId, setBusyCampaignId] = useState("");
  const [message, setMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");

  useEffect(() => {
    let active = true;
    const catalog = createRemoteCatalog();
    const loadProducts = async () => {
      const manifest = await catalog.getManifest();
      const groups = await Promise.all(manifest.categories.map((category) => catalog.getCategoryProducts(category.id)));
      return groups.flat();
    };
    Promise.all([loadProducts(), getDiscountCodes(), getNotificationCampaigns()])
      .then(([catalogProducts, codes, notificationCampaigns]) => {
        if (!active) return;
        setProducts(catalogProducts);
        setDiscountCodes(codes);
        setCampaigns(notificationCampaigns);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudieron cargar las notificaciones."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!body && editorRef.current?.innerHTML) editorRef.current.innerHTML = "";
  }, [body]);

  useEffect(() => {
    const closeSuggestions = (event: PointerEvent) => {
      if (!productSearchRef.current?.contains(event.target as Node)) setProductSuggestionsOpen(false);
    };
    document.addEventListener("pointerdown", closeSuggestions);
    return () => document.removeEventListener("pointerdown", closeSuggestions);
  }, []);

  const matchingProducts = useMemo(() => {
    const terms = normalizeProductSearch(productSearch).split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      if (product.active === false) return false;
      if (!terms.length) return true;
      const searchable = normalizeProductSearch([product.name, product.brand, product.category, product.id].filter(Boolean).join(" "));
      return terms.every((term) => searchable.includes(term));
    });
  }, [productSearch, products]);

  const chooseProduct = (product: Product) => {
    setTarget(product.id);
    setProductSearch(product.name);
    setProductSuggestionsOpen(false);
  };

  const saveCampaign = async () => {
    setMessage("");
    if (!title.trim() || !notificationPlainText(body)) { setMessage("Completá el título y el mensaje."); return; }
    if ((action === "coupon" || action === "product" || action === "search") && !target.trim()) { setMessage("Elegí el cupón o producto asociado a la acción."); return; }
    setSaving(true);
    try {
      const campaign = await createNotificationCampaign({
        title: title.trim(), body: sanitizeNotificationHtml(body), bodyText: notificationPlainText(body), audience,
        action, target: target.trim(), status,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : "",
      }, user.email || user.uid);
      if (action === "coupon") {
        const code = normalizeDiscountCode(target);
        const nextCodes = discountCodes.filter((item) => item.code !== code).concat({
          code, percentage: couponPercentage, active: true, validFrom: "", validUntil: expiresAt,
          usageLimit: couponUsageLimit, usageCount: 0, perUserLimit: couponPerUserLimit,
          audience: audience === "business" ? "business" as const : "all" as const,
          source: "notification" as const, campaignId: campaign.id,
        });
        setDiscountCodes(await saveDiscountCodes(nextCodes, user.email || user.uid));
      }
      setCampaigns((current) => [campaign, ...current]);
      setMessage(status === "draft" ? "Campaña guardada como borrador." : status === "scheduled" ? "Campaña programada." : "Campaña publicada en la campanita de la tienda.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la campaña.");
    } finally { setSaving(false); }
  };

  const finishCampaign = async (campaign: NotificationCampaign) => {
    if (busyCampaignId || !window.confirm(`¿Finalizar la campaña “${campaign.title}”? Dejará de aparecer en la tienda.`)) return;
    setBusyCampaignId(campaign.id);
    setHistoryMessage("");
    try {
      await finishNotificationCampaign(campaign.id, user.email || user.uid);
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, status: "finished" } : item));
      setHistoryMessage(`La campaña “${campaign.title}” fue finalizada.`);
    } catch (error) { setHistoryMessage(error instanceof Error ? error.message : "No se pudo finalizar la campaña."); }
    finally { setBusyCampaignId(""); }
  };

  const deleteCampaign = async (campaign: NotificationCampaign) => {
    if (busyCampaignId || !window.confirm(`¿Borrar la campaña “${campaign.title}”? Desaparecerá definitivamente de la campanita de la app.`)) return;
    setBusyCampaignId(campaign.id);
    setHistoryMessage("");
    try {
      await deleteNotificationCampaign(campaign.id);
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setHistoryMessage(`La campaña “${campaign.title}” fue borrada de la app.`);
    } catch (error) { setHistoryMessage(error instanceof Error ? error.message : "No se pudo borrar la campaña."); }
    finally { setBusyCampaignId(""); }
  };

  return <div className="admin-content-box admin-store-config">
    <section className="admin-card admin-notification-config">
      <div className="admin-card__head"><div className="admin-headline"><h1 className="admin-title">Notificaciones</h1><p>Creá campañas y administrá qué novedades permanecen visibles en la app.</p></div><span className="admin-module-state">{loading ? "Cargando" : "Activo"}</span></div>
      <div className="admin-card__body admin-notification-layout">
        <div className="admin-notification-form">
          <label><span>Título</span><input className="admin-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={55} placeholder="Ej: Tenés un cupón disponible"/></label>
          <div className="admin-rich-field"><span>Mensaje</span><div className="admin-rich-toolbar" aria-label="Formato del mensaje"><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("bold"); }} aria-label="Negrita"><b>B</b></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("italic"); }} aria-label="Cursiva"><i>I</i></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("underline"); }} aria-label="Subrayado"><u>U</u></button><label className="admin-rich-color" title="Color del texto"><span>Color</span><input type="color" defaultValue="#c81b16" onInput={(event) => { editorRef.current?.focus(); document.execCommand("foreColor", false, event.currentTarget.value); setBody(sanitizeNotificationHtml(editorRef.current?.innerHTML || "")); }}/></label><div className="admin-rich-emojis">{NOTIFICATION_EMOJIS.map((emoji) => <button type="button" key={emoji} onMouseDown={(event) => { event.preventDefault(); document.execCommand("insertText", false, emoji); setBody(sanitizeNotificationHtml(editorRef.current?.innerHTML || "")); }} aria-label={`Insertar ${emoji}`}>{emoji}</button>)}</div></div><div ref={editorRef} className="admin-rich-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Contale al usuario qué beneficio recibió." onInput={(event) => setBody(sanitizeNotificationHtml(event.currentTarget.innerHTML))} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain").slice(0, 500)); }} /></div>
          <div className="admin-notification-row"><label><span>Destinatarios</span><select className="admin-input" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}><option value="all">Todos los clientes</option><option value="business">Solo comercios</option><option value="consumer">Consumidores finales</option></select></label><label><span>Acción al tocar</span><select className="admin-input" value={action} onChange={(event) => { setAction(event.target.value as NotificationAction); setTarget(""); setProductSearch(""); setProductSuggestionsOpen(false); }}><option value="none">Solo abrir la app</option><option value="coupon">Agregar cupón al carrito</option><option value="search">Buscar en la tienda</option><option value="catalog">Abrir la tienda</option><option value="product">Abrir un producto</option><option value="cart">Abrir el carrito</option></select></label></div>
          {action === "coupon" ? <div className="admin-notification-coupon"><label><span>Código del cupón</span><input className="admin-input" value={target} onChange={(event) => setTarget(normalizeDiscountCode(event.target.value))} maxLength={24} placeholder="EJ: POLLOS10"/></label><label><span>Descuento</span><div className="admin-discount-number"><input className="admin-input" type="number" min="1" max="100" value={couponPercentage} onChange={(event) => setCouponPercentage(Number(event.target.value))}/><b>%</b></div></label><label><span>Usos totales <em>0 = ilimitado</em></span><input className="admin-input" type="number" min="0" value={couponUsageLimit} onChange={(event) => setCouponUsageLimit(Math.max(0, Number(event.target.value)))}/></label><label><span>Usos por usuario</span><input className="admin-input" type="number" min="1" value={couponPerUserLimit} onChange={(event) => setCouponPerUserLimit(Math.max(1, Number(event.target.value)))}/></label></div> : null}
          {action === "search" ? <label><span>Texto que se buscará</span><input className="admin-input" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Ej: pollos"/></label> : null}
          {action === "product" ? <div className="admin-product-picker" ref={productSearchRef}><label htmlFor="notification-product-search">Producto a abrir</label><input id="notification-product-search" className="admin-input" type="search" value={productSearch} placeholder="Buscar por nombre, marca o código" autoComplete="off" onFocus={() => setProductSuggestionsOpen(true)} onChange={(event) => { setProductSearch(event.target.value); setTarget(""); setProductSuggestionsOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setProductSuggestionsOpen(false); if (event.key === "Enter" && matchingProducts[0]) { event.preventDefault(); chooseProduct(matchingProducts[0]); } }}/>{productSuggestionsOpen ? <ul className="dropdown sugerencias admin-product-suggestions" role="listbox">{matchingProducts.length ? matchingProducts.map((product) => <li key={product.id}><button type="button" role="option" aria-selected={target === product.id} onClick={() => chooseProduct(product)}><strong>{product.name}</strong><small>{[product.brand, product.category, product.id].filter(Boolean).join(" · ")}</small></button></li>) : <li className="admin-product-suggestions__empty">No encontramos productos con esa búsqueda.</li>}</ul> : null}</div> : null}
          <div className="admin-notification-row"><label><span>Estado</span><select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value as NotificationStatus)}><option value="draft">Borrador</option><option value="scheduled">Programada</option><option value="sent">Publicar ahora</option><option value="paused">Pausada</option></select></label><label><span>Programar para</span><input className="admin-input" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={status !== "scheduled"}/></label></div>
          <label><span>Caducidad de la campaña y cupón <em>Opcional</em></span><input className="admin-input" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)}/></label>
          <div className="admin-notification-actions"><button type="button" className="btn ghost" onClick={() => { setTitle(""); setBody(""); setAction("none"); setTarget(""); setMessage(""); }}>Limpiar</button><button type="button" className="btn primary" onClick={() => void saveCampaign()} disabled={saving || loading}>{saving ? "Guardando..." : status === "sent" ? "Publicar campaña" : "Guardar campaña"}</button></div>
          {message ? <div className="admin-users-message" role="status">{message}</div> : null}
        </div>
        <aside className="admin-notification-preview" aria-label="Vista previa de la notificación"><span>Vista previa</span><div className="admin-notification-preview__card"><div className="admin-notification-preview__icon">J</div><div><strong>{title || "Título de la notificación"}</strong>{body ? <p dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(body) }} /> : <p>El mensaje que reciba el cliente aparecerá acá.</p>}<small>JOMA Express · ahora</small></div></div><div className="admin-notification-action-summary"><span>Al tocar</span><strong>{action === "coupon" ? `Agregar cupón ${target || "seleccionado"}` : action === "search" ? `Buscar “${target || "..."}”` : action === "catalog" ? "Abrir la tienda" : action === "product" ? "Abrir el producto seleccionado" : action === "cart" ? "Abrir el carrito" : "Abrir la app"}</strong></div></aside>
      </div>
      <div className="admin-card__body admin-notification-history">
        <div className="admin-notification-history__head"><div><h2>Historial de campañas</h2><p>Finalizá una campaña o borrala definitivamente para quitarla de la campanita de la app.</p></div><span className="ofertas-count">{campaigns.length}</span></div>
        {historyMessage ? <div className="admin-users-message" role="status">{historyMessage}</div> : null}
        {campaigns.length ? <div className="admin-notification-history__list">{campaigns.map((campaign) => { const canFinish = campaign.status === "sent" || campaign.status === "scheduled" || campaign.status === "paused"; return <article className="admin-notification-history__item" key={campaign.id}><div className="admin-notification-history__copy"><strong>{campaign.title || "Campaña sin título"}</strong><p>{campaign.bodyText || notificationPlainText(campaign.body) || "Sin mensaje"}</p><small>{formatCampaignDate(campaign.createdAtIso)} · {audienceLabel(campaign.audience)}</small></div><span className={`admin-notification-status is-${campaign.status}`}>{statusLabel(campaign.status)}</span><div className="admin-notification-history__actions">{canFinish ? <button type="button" className="btn ghost admin-campaign-finish" onClick={() => void finishCampaign(campaign)} disabled={Boolean(busyCampaignId)}>{busyCampaignId === campaign.id ? "Procesando..." : "Finalizar"}</button> : null}<button type="button" className="btn ofertas-danger admin-campaign-delete" onClick={() => void deleteCampaign(campaign)} disabled={Boolean(busyCampaignId)}>{busyCampaignId === campaign.id ? "Procesando..." : "Borrar"}</button></div></article>; })}</div> : <div className="admin-notification-history__empty">{loading ? "Cargando campañas..." : "Todavía no hay campañas guardadas."}</div>}
      </div>
    </section>
  </div>;
}
