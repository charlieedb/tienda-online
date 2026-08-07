import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { submitCheckoutOrder } from "@/lib/checkoutOrders";
import { getCachedUserProfile, refreshUserProfile, upsertUserProfile } from "@/lib/userProfile";
import { notifyTelegramOrder } from "@/lib/telegramOrders";
import { DEFAULT_DELIVERY_SCHEDULE, getDeliveryScheduleConfig } from "@/lib/featuredProducts";
import { buildDeliveryDates, buildDeliveryTimeRanges } from "@/lib/deliverySchedule";
import type { LatLng } from "@/lib/userProfile";
import { getCartItemUnits, getRemainingStock, useCartStore } from "@/store/cart";
import { Icon } from "./Icons";
import { MapPickerModal } from "./MapPickerModal";
import { CartExpiryCountdown } from "./CartExpiryGuard";
import { trackEvent } from "@/lib/analytics";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const PROFILE_KEY = "joma.profile.v1";

type CheckoutForm = { nombre: string; telefono: string; direccion: string; nota: string };
const EMPTY_FORM: CheckoutForm = { nombre: "", telefono: "", direccion: "", nota: "" };

function createRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function addressText(address?: { direccion?: string; localidad?: string; provincia?: string } | null) {
  return [address?.direccion, address?.localidad, address?.provincia].map((value) => String(value ?? "").trim()).filter(Boolean).join(", ");
}

function readLocalProfile(uid: string): CheckoutForm {
  try {
    const raw = JSON.parse(localStorage.getItem(`${PROFILE_KEY}.${uid}`) || "{}") as Record<string, unknown>;
    return {
      nombre: String(raw.name ?? ""),
      telefono: String(raw.phone ?? ""),
      direccion: [raw.address, raw.city].map((value) => String(value ?? "").trim()).filter(Boolean).join(", "),
      nota: String(raw.notes ?? ""),
    };
  } catch { return EMPTY_FORM; }
}

function readLocalLocation(uid: string): LatLng | null {
  try {
    const raw = JSON.parse(localStorage.getItem(`${PROFILE_KEY}.${uid}`) || "{}") as Record<string, unknown>;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

export function CartView({ onContinue, onRequireAuth }: { onContinue: () => void; onRequireAuth?: () => void }) {
  const { user } = useAuth();
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const decItem = useCartStore((state) => state.decItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentWarning, setSentWarning] = useState("");
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [deliveryLocation, setDeliveryLocation] = useState<LatLng | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [deliverySchedule, setDeliverySchedule] = useState(DEFAULT_DELIVERY_SCHEDULE);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeRange, setDeliveryTimeRange] = useState("");
  const orderRequestId = useRef(createRequestId());
  const submitCompleteRef = useRef(false);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
  const deliveryDates = useMemo(() => buildDeliveryDates(deliverySchedule), [deliverySchedule]);
  const deliveryTimeRanges = useMemo(() => buildDeliveryTimeRanges(deliverySchedule), [deliverySchedule]);

  useEffect(() => {
    if (!submitting) return;
    const timer = window.setInterval(() => {
      if (submitCompleteRef.current) return;
      setSubmitProgress((current) => {
        const increment = current < 70 ? .72 : current < 88 ? .28 : .07;
        return Math.min(94, current + increment);
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [submitting]);

  useEffect(() => {
    if (!checkoutOpen) return;
    let active = true;
    setDeliveryLoading(true);
    getDeliveryScheduleConfig()
      .then((schedule) => {
        if (!active) return;
        setDeliverySchedule(schedule);
        const dates = buildDeliveryDates(schedule);
        const timeRanges = buildDeliveryTimeRanges(schedule);
        setDeliveryDate((current) => dates.some((date) => date.value === current) ? current : dates[0]?.value || "");
        setDeliveryTimeRange((current) => timeRanges.includes(current) ? current : timeRanges[0] || "");
      })
      .finally(() => {
        if (active) setDeliveryLoading(false);
      });
    return () => { active = false; };
  }, [checkoutOpen]);

  useEffect(() => {
    if (!checkoutOpen || !user) return;
    let active = true;
    const local = readLocalProfile(user.uid);
    const localLocation = readLocalLocation(user.uid);
    const cached = getCachedUserProfile(user.uid);
    const fill = (profile: typeof cached) => {
      setForm((current) => ({
        nombre: current.nombre || local.nombre || [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || user.displayName || "",
        telefono: current.telefono || local.telefono || profile?.telefono || "",
        direccion: current.direccion || local.direccion || addressText(profile?.direcciones?.[0]),
        nota: current.nota || local.nota || profile?.notes || "",
      }));
      setDeliveryLocation((current) => current ?? localLocation ?? profile?.direcciones?.[0]?.ubicacion ?? null);
    };
    fill(cached);
    setProfileLoading(true);
    refreshUserProfile(user.uid).then((profile) => { if (active) fill(profile); }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [checkoutOpen, user]);

  const submit = async () => {
    const selectedDeliveryDate = deliveryDates.find((date) => date.value === deliveryDate);
    if (!selectedDeliveryDate || !deliveryTimeRange) {
      setError("Elegí el día y la franja horaria para recibir el pedido."); return;
    }
    const customer = {
      nombre: form.nombre.trim(), telefono: form.telefono.trim(), direccion: form.direccion.trim(), nota: form.nota.trim(), ubicacion: deliveryLocation,
    };
    if (!customer.nombre || !customer.telefono || !customer.direccion) {
      setError("Completá nombre, teléfono y dirección para confirmar la compra."); return;
    }
    submitCompleteRef.current = false; setSubmitting(true); setSubmitProgress(3); setError("");
    try {
      if (!user) throw new Error("Necesitás iniciar sesión para confirmar la compra.");
      const savedProfile = getCachedUserProfile(user.uid) ?? await refreshUserProfile(user.uid);
      const savedName = [savedProfile?.nombre, savedProfile?.apellido].filter(Boolean).join(" ").trim();
      const savedAddress = addressText(savedProfile?.direcciones?.[0]);
      const savedLocation = savedProfile?.direcciones?.[0]?.ubicacion ?? null;
      const locationChanged = savedLocation?.lat !== customer.ubicacion?.lat || savedLocation?.lng !== customer.ubicacion?.lng;
      const profileChanged = !savedProfile || savedName !== customer.nombre ||
        String(savedProfile.telefono || "").trim() !== customer.telefono ||
        savedAddress !== customer.direccion || String(savedProfile.notes || "").trim() !== customer.nota || locationChanged;
      if (profileChanged) {
        void upsertUserProfile({
          uid: user.uid, email: user.email,
          username: savedProfile?.username || user.email?.split("@")[0] || `usuario_${user.uid.slice(0, 8)}`,
          dni: savedProfile?.dni || "", displayName: savedProfile?.displayName || user.displayName,
          preventistaReferido: savedProfile?.preventistaReferido || "",
          nombre: customer.nombre, apellido: "", telefono: customer.telefono, notes: customer.nota,
          direcciones: [{ id: "principal", provincia: "", localidad: "", direccion: customer.direccion, ubicacion: customer.ubicacion }],
        }).catch((profileError) => {
          console.error("No se pudo actualizar el perfil después del checkout", profileError);
        });
      }
      const result = await submitCheckoutOrder({
        user,
        customer: { ...customer, preventistaReferido: savedProfile?.preventistaReferido || "" },
        cartItems: items,
        productsById: new Map(),
        requestId: orderRequestId.current,
        delivery: {
          date: selectedDeliveryDate.value,
          dateLabel: selectedDeliveryDate.label,
          timeRange: deliveryTimeRange,
        },
      });
      submitCompleteRef.current = true;
      setSubmitProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 360));
      void notifyTelegramOrder(result.telegramPayload).catch((telegramError) => {
        console.error("El pedido se confirmó, pero falló el aviso de Telegram", telegramError);
        setSentWarning("El pedido y el stock quedaron confirmados, pero el aviso de Telegram no pudo enviarse.");
      });
      try {
        localStorage.setItem(`${PROFILE_KEY}.${user.uid}`, JSON.stringify({ name: customer.nombre, phone: customer.telefono, address: customer.direccion, city: "", notes: customer.nota, lat: customer.ubicacion?.lat, lng: customer.ubicacion?.lng }));
      } catch { /* el pedido ya fue enviado */ }
      clear(); setCheckoutOpen(false); setSentWarning(""); setSent(true); setForm(EMPTY_FORM); setDeliveryLocation(null); setDeliveryDate(""); setDeliveryTimeRange(""); orderRequestId.current = createRequestId();
    } catch (nextError) {
      submitCompleteRef.current = false;
      setSubmitProgress(0);
      setError(nextError instanceof Error ? nextError.message : "No pudimos enviar el pedido.");
    } finally { setSubmitting(false); }
  };

  if (!items.length && !sent) return <section className="empty-state">
    <div className="empty-icon"><Icon name="cart" /></div><h2>Tu carrito está esperando</h2><p>Agregá tus productos favoritos y los vas a encontrar acá.</p>
    <button type="button" className="primary-action" onClick={onContinue}>Explorar productos</button>
  </section>;

  return <>
    {sent ? <section className="order-success"><div className="success-check"><Icon name="check"/></div><h2>Pedido confirmado :)</h2><p>Nos comunicaremos con vos en breve, para coordinar la entrega y la forma de pago.<br/>Muchas gracias</p>{sentWarning ? <div className="checkout-error" role="status">{sentWarning}</div> : null}<button type="button" className="primary-action" onClick={() => window.location.reload()}>Volver al inicio</button></section> : <section className="cart-page">
      <div className="section-heading cart-heading"><div><span>Tu compra</span><h2>Carrito</h2><CartExpiryCountdown /></div><button type="button" className="clear-button" onClick={clear}><Icon name="trash" /> Vaciar</button></div>
      <div className="cart-list"><AnimatePresence initial={false}>{items.map((item) => { const remaining = getRemainingStock(items, item.productId, item.stockLimit); const canAdd = remaining === undefined || remaining >= getCartItemUnits({ ...item, qty: 1 }); return <motion.article layout exit={{ opacity: 0, x: 24 }} key={item.id} className="cart-item">
        <div className="cart-item-copy"><strong>{item.name}</strong><span>{item.label}</span><b>{money.format(item.price * item.qty)}</b></div>
        <div className="cart-item-actions"><div className="stepper compact"><button type="button" onClick={() => decItem(item.id)} aria-label={`Disminuir ${item.name}`}><Icon name="minus" /></button><output>{item.qty}</output><button type="button" onClick={() => addItem({ id: item.id, productId: item.productId, name: item.name, variant: item.variant, label: item.label, price: item.price, listPrice: item.listPrice, discountPct: item.discountPct, unitPriceFinal: item.unitPriceFinal, unitsPerPack: item.unitsPerPack, stockLimit: item.stockLimit }, 1)} aria-label={`Aumentar ${item.name}`} disabled={!canAdd}><Icon name="plus" /></button></div><button className="remove-button" type="button" onClick={() => removeItem(item.id)}>Quitar</button></div>
      </motion.article>; })}</AnimatePresence></div>
      <div className="cart-summary"><div><span>Total estimado</span><strong>{money.format(total)}</strong></div><p>Revisá las cantidades antes de confirmar.</p><button type="button" className="checkout-button" onClick={() => {
        if (!user && onRequireAuth) { onRequireAuth(); return; }
        trackEvent("begin_checkout", { value: total, currency: "ARS", item_count: items.length });
        setError(""); setCheckoutOpen(true);
      }}>{user ? "Confirmar compra" : "Iniciar sesión para confirmar"}</button></div>
    </section>}

    <AnimatePresence>{checkoutOpen && !mapOpen ? <><motion.button type="button" className="checkout-backdrop" aria-label="Cerrar confirmación" onClick={() => !submitting && setCheckoutOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.section className="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: .26, ease: [0.22, 1, 0.36, 1] }}><div className="checkout-head"><div><span>Último paso</span><h2 id="checkout-title">Confirmar compra</h2></div><button type="button" onClick={() => setCheckoutOpen(false)} disabled={submitting} aria-label="Cerrar"><Icon name="close"/></button></div><div className="checkout-body">
      {profileLoading ? <div className="checkout-notice"><span className="tiny-spinner"/> Completando tus datos guardados…</div> : null}
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <fieldset className="checkout-delivery" disabled={submitting || deliveryLoading}>
        <h3>¿Cuándo querés recibir tu compra?</h3>
        <p>Elegí desde mañana. Los domingos no realizamos entregas.</p>
        {deliveryLoading ? <div className="checkout-notice"><span className="tiny-spinner"/> Consultando horarios…</div> : <>
          <div className="checkout-delivery-days">
            {deliveryDates.map((date) => <button type="button" className={deliveryDate === date.value ? "is-active" : ""} onClick={() => setDeliveryDate(date.value)} aria-pressed={deliveryDate === date.value} key={date.value}>{date.shortLabel}</button>)}
          </div>
          <label className="checkout-delivery-time"><span>Franja de entrega</span><select value={deliveryTimeRange} onChange={(event) => setDeliveryTimeRange(event.target.value)}>
            {deliveryTimeRanges.map((timeRange) => <option value={timeRange} key={timeRange}>{timeRange}</option>)}
          </select></label>
        </>}
      </fieldset>
      <label><span>Nombre y apellido</span><input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} autoComplete="name" placeholder="Tu nombre"/></label>
      <label><span>Teléfono</span><input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} autoComplete="tel" inputMode="tel" placeholder="WhatsApp o teléfono"/></label>
      <label><span>Dirección de entrega</span><input value={form.direccion} onChange={(event) => { setForm((current) => ({ ...current, direccion: event.target.value })); setDeliveryLocation(null); }} autoComplete="street-address" placeholder="Calle, número y localidad"/></label>
      <button type="button" className={`checkout-location-button ${deliveryLocation ? "is-marked" : ""}`} onClick={() => setMapOpen(true)} disabled={submitting}><span aria-hidden="true">📍</span><span>{deliveryLocation ? "Ubicación guardada" : "Marcar punto de entrega"}</span>{deliveryLocation ? <small>{deliveryLocation.lat.toFixed(5)}, {deliveryLocation.lng.toFixed(5)}</small> : null}</button>
      <label><span>Nota <em>Opcional</em></span><textarea value={form.nota} onChange={(event) => setForm((current) => ({ ...current, nota: event.target.value }))} rows={3} placeholder="Aclaraciones para el pedido"/></label>
    </div><div className="checkout-actions"><button type="button" className="checkout-cancel" onClick={() => setCheckoutOpen(false)} disabled={submitting}>Cancelar</button><button type="button" className={`checkout-submit ${submitting ? "is-submitting" : ""}`} onClick={submit} disabled={submitting || profileLoading || deliveryLoading || !deliveryDate || !deliveryTimeRange} aria-label={submitting ? `Enviando pedido, ${submitProgress}% completado` : "Enviar pedido"} aria-busy={submitting}>{submitting ? <><span className="checkout-submit-progress" style={{ transform: `scaleX(${submitProgress / 100})` }} aria-hidden="true"/><span className="checkout-submit-label">Enviando pedido...</span></> : "Enviar pedido"}</button></div></motion.section></> : null}</AnimatePresence>
    <MapPickerModal open={mapOpen} initial={deliveryLocation} center={deliveryLocation} initialQuery={form.direccion} onClose={() => setMapOpen(false)} onPick={setDeliveryLocation}/>
  </>;
}
