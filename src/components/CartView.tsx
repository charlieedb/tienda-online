import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { submitCheckoutOrder } from "@/lib/checkoutOrders";
import { getCachedUserProfile, refreshUserProfile, upsertUserProfile } from "@/lib/userProfile";
import { notifyTelegramOrder } from "@/lib/telegramOrders";
import { getCartItemUnits, getRemainingStock, useCartStore } from "@/store/cart";
import { Icon } from "./Icons";

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

export function CartView({ onContinue }: { onContinue: () => void }) {
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
  const [submitProgressLabel, setSubmitProgressLabel] = useState("Preparando pedido");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentWarning, setSentWarning] = useState("");
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const orderRequestId = useRef(createRequestId());
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);

  useEffect(() => {
    if (!checkoutOpen || !user) return;
    let active = true;
    const local = readLocalProfile(user.uid);
    const cached = getCachedUserProfile(user.uid);
    const fill = (profile: typeof cached) => setForm((current) => ({
      nombre: current.nombre || local.nombre || [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") || user.displayName || "",
      telefono: current.telefono || local.telefono || profile?.telefono || "",
      direccion: current.direccion || local.direccion || addressText(profile?.direcciones?.[0]),
      nota: current.nota || local.nota || profile?.notes || "",
    }));
    fill(cached);
    setProfileLoading(true);
    refreshUserProfile(user.uid).then((profile) => { if (active) fill(profile); }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [checkoutOpen, user]);

  const submit = async () => {
    const customer = {
      nombre: form.nombre.trim(), telefono: form.telefono.trim(), direccion: form.direccion.trim(), nota: form.nota.trim(),
    };
    if (!customer.nombre || !customer.telefono || !customer.direccion) {
      setError("Completá nombre, teléfono y dirección para confirmar la compra."); return;
    }
    setSubmitting(true); setSubmitProgress(5); setSubmitProgressLabel("Preparando pedido"); setError("");
    try {
      if (!user) throw new Error("Necesitás iniciar sesión para confirmar la compra.");
      const savedProfile = getCachedUserProfile(user.uid) ?? await refreshUserProfile(user.uid);
      const savedName = [savedProfile?.nombre, savedProfile?.apellido].filter(Boolean).join(" ").trim();
      const savedAddress = addressText(savedProfile?.direcciones?.[0]);
      const profileChanged = !savedProfile || savedName !== customer.nombre ||
        String(savedProfile.telefono || "").trim() !== customer.telefono ||
        savedAddress !== customer.direccion || String(savedProfile.notes || "").trim() !== customer.nota;
      if (profileChanged) {
        await upsertUserProfile({
          uid: user.uid, email: user.email,
          username: savedProfile?.username || user.email?.split("@")[0] || `usuario_${user.uid.slice(0, 8)}`,
          dni: savedProfile?.dni || "", displayName: savedProfile?.displayName || user.displayName,
          nombre: customer.nombre, apellido: "", telefono: customer.telefono, notes: customer.nota,
          direcciones: [{ id: "principal", provincia: "", localidad: "", direccion: customer.direccion, ubicacion: null }],
        });
      }
      setSubmitProgress(15); setSubmitProgressLabel("Validando productos");
      const result = await submitCheckoutOrder({
        user,
        customer,
        cartItems: items,
        productsById: new Map(),
        requestId: orderRequestId.current,
        onProgress: (progress, label) => {
          setSubmitProgress(progress);
          setSubmitProgressLabel(label);
        },
      });
      let telegramWarning = "";
      try {
        setSubmitProgress(88); setSubmitProgressLabel("Enviando aviso");
        await notifyTelegramOrder(result.telegramPayload);
      } catch {
        telegramWarning = "El pedido y el stock quedaron confirmados, pero el aviso de Telegram no pudo enviarse.";
      }
      setSubmitProgress(100); setSubmitProgressLabel("Pedido confirmado");
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      try {
        localStorage.setItem(`${PROFILE_KEY}.${user.uid}`, JSON.stringify({ name: customer.nombre, phone: customer.telefono, address: customer.direccion, city: "", notes: customer.nota }));
      } catch { /* el pedido ya fue enviado */ }
      clear(); setCheckoutOpen(false); setSentWarning(telegramWarning); setSent(true); setForm(EMPTY_FORM); orderRequestId.current = createRequestId();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos enviar el pedido.");
    } finally { setSubmitting(false); }
  };

  if (!items.length && !sent) return <section className="empty-state">
    <div className="empty-icon"><Icon name="cart" /></div><h2>Tu carrito está esperando</h2><p>Agregá tus productos favoritos y los vas a encontrar acá.</p>
    <button type="button" className="primary-action" onClick={onContinue}>Explorar productos</button>
  </section>;

  return <>
    {sent ? <section className="order-success"><div className="success-check"><Icon name="check"/></div><h2>Pedido enviado</h2><p>Recibimos tu compra correctamente. En breve nos comunicaremos con vos.</p>{sentWarning ? <div className="checkout-error" role="status">{sentWarning}</div> : null}<button type="button" className="primary-action" onClick={() => window.location.reload()}>Volver al inicio</button></section> : <section className="cart-page">
      <div className="section-heading cart-heading"><div><span>Tu compra</span><h2>Carrito</h2></div><button type="button" className="clear-button" onClick={clear}><Icon name="trash" /> Vaciar</button></div>
      <div className="cart-list"><AnimatePresence initial={false}>{items.map((item) => { const remaining = getRemainingStock(items, item.productId, item.stockLimit); const canAdd = remaining === undefined || remaining >= getCartItemUnits({ ...item, qty: 1 }); return <motion.article layout exit={{ opacity: 0, x: 24 }} key={item.id} className="cart-item">
        <div className="cart-item-copy"><strong>{item.name}</strong><span>{item.label}</span><b>{money.format(item.price * item.qty)}</b></div>
        <div className="cart-item-actions"><div className="stepper compact"><button type="button" onClick={() => decItem(item.id)} aria-label={`Disminuir ${item.name}`}><Icon name="minus" /></button><output>{item.qty}</output><button type="button" onClick={() => addItem({ id: item.id, productId: item.productId, name: item.name, variant: item.variant, label: item.label, price: item.price, listPrice: item.listPrice, discountPct: item.discountPct, unitPriceFinal: item.unitPriceFinal, unitsPerPack: item.unitsPerPack, stockLimit: item.stockLimit }, 1)} aria-label={`Aumentar ${item.name}`} disabled={!canAdd}><Icon name="plus" /></button></div><button className="remove-button" type="button" onClick={() => removeItem(item.id)}>Quitar</button></div>
      </motion.article>; })}</AnimatePresence></div>
      <div className="cart-summary"><div><span>Total estimado</span><strong>{money.format(total)}</strong></div><p>Revisá las cantidades antes de confirmar.</p><button type="button" className="checkout-button" onClick={() => { setError(""); setCheckoutOpen(true); }}>Confirmar compra</button></div>
    </section>}

    <AnimatePresence>{checkoutOpen ? <><motion.button type="button" className="checkout-backdrop" aria-label="Cerrar confirmación" onClick={() => !submitting && setCheckoutOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.section className="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: .26, ease: [0.22, 1, 0.36, 1] }}><div className="checkout-head"><div><span>Último paso</span><h2 id="checkout-title">Confirmar compra</h2></div><button type="button" onClick={() => setCheckoutOpen(false)} disabled={submitting} aria-label="Cerrar"><Icon name="close"/></button></div><div className="checkout-body">
      {profileLoading ? <div className="checkout-notice"><span className="tiny-spinner"/> Completando tus datos guardados…</div> : null}
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <label><span>Nombre y apellido</span><input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} autoComplete="name" placeholder="Tu nombre"/></label>
      <label><span>Teléfono</span><input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} autoComplete="tel" inputMode="tel" placeholder="WhatsApp o teléfono"/></label>
      <label><span>Dirección de entrega</span><input value={form.direccion} onChange={(event) => setForm((current) => ({ ...current, direccion: event.target.value }))} autoComplete="street-address" placeholder="Calle, número y localidad"/></label>
      <label><span>Nota <em>Opcional</em></span><textarea value={form.nota} onChange={(event) => setForm((current) => ({ ...current, nota: event.target.value }))} rows={3} placeholder="Aclaraciones para el pedido"/></label>
    </div>{submitting ? <div className="checkout-progress" aria-live="polite"><div className="checkout-progress-copy"><span>{submitProgressLabel}</span><strong>{submitProgress}%</strong></div><div className="checkout-progress-track" role="progressbar" aria-label="Progreso del pedido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={submitProgress}><span style={{ width: `${submitProgress}%` }}/></div></div> : null}<div className="checkout-actions"><button type="button" className="checkout-cancel" onClick={() => setCheckoutOpen(false)} disabled={submitting}>Cancelar</button><button type="button" className="checkout-submit" onClick={submit} disabled={submitting || profileLoading}>{submitting ? <><span className="tiny-spinner"/> Enviando…</> : "Enviar pedido"}</button></div></motion.section></> : null}</AnimatePresence>
  </>;
}
