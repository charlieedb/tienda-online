import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { submitCheckoutOrder } from "@/lib/checkoutOrders";
import { getCachedUserProfile, refreshUserProfile, upsertUserProfile } from "@/lib/userProfile";
import { notifyTelegramOrder } from "@/lib/telegramOrders";
import { DEFAULT_CHECKOUT_SETTINGS, DEFAULT_DELIVERY_SCHEDULE, getCheckoutSettingsConfig, getDeliveryScheduleConfig } from "@/lib/featuredProducts";
import { buildDeliveryDates, buildDeliveryTimeRanges } from "@/lib/deliverySchedule";
import type { LatLng } from "@/lib/userProfile";
import { getCartPricingMap, getCartItemUnits, getRemainingStock, useCartStore } from "@/store/cart";
import { Icon } from "./Icons";
import { CartPriceBreakdown } from "./CartPriceBreakdown";
import { MapPickerModal } from "./MapPickerModal";
import { CartExpiryCountdown } from "./CartExpiryGuard";
import { getCampaignAttribution, trackEcommerce } from "@/lib/analytics";
import { getActiveCatalog, type Product } from "@/lib/products";
import { calculateDiscount, validateDiscountCode } from "@/lib/discountCodes";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const PROFILE_KEY = "joma.profile.v1";

type CheckoutForm = { nombre: string; telefono: string; direccion: string; nota: string };
type PaymentMethod = "cash" | "transfer";
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
  const appliedCode = useCartStore((state) => state.appliedDiscountCode);
  const setAppliedCode = useCartStore((state) => state.setAppliedDiscountCode);
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
  const [checkoutSettings, setCheckoutSettings] = useState(DEFAULT_CHECKOUT_SETTINGS);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const productsByIdRef = useRef<Map<string, Product>>(new Map());
  const orderRequestId = useRef(createRequestId());
  const submitCompleteRef = useRef(false);
  const pricingByItem = useMemo(() => getCartPricingMap(items), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + pricingByItem.get(item.id)!.total, 0), [items, pricingByItem]);
  const finalTotal = Math.max(0, total - (appliedCode?.discountAmount || 0));
  const shippingCharge = checkoutSettings.freeShipping ? 0 : checkoutSettings.shippingCost;
  const checkoutTotal = finalTotal + shippingCharge;
  const minimumRemaining = Math.max(0, checkoutSettings.minimumOrder - finalTotal);
  const minimumCompleted = minimumRemaining === 0;
  const minimumProgress = checkoutSettings.minimumOrder > 0 ? Math.min(100, (finalTotal / checkoutSettings.minimumOrder) * 100) : 100;

  useEffect(() => {
    getCheckoutSettingsConfig().then(setCheckoutSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const paramsCoupon = currentUrl.searchParams.get("coupon");
    const pendingCoupon = paramsCoupon || window.sessionStorage.getItem("joma.pendingCoupon");
    if (!pendingCoupon) return;
    window.sessionStorage.setItem("joma.pendingCoupon", pendingCoupon);
    if (paramsCoupon) {
      currentUrl.searchParams.delete("coupon");
      window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    setDiscountInput(pendingCoupon);
  }, []);

  useEffect(() => {
    const clearBusinessCoupon = () => {
      window.sessionStorage.removeItem("joma.pendingCoupon");
      setDiscountInput("");
      setAppliedCode(null);
      setDiscountError("");
    };
    window.addEventListener("joma:business-removed", clearBusinessCoupon);
    return () => window.removeEventListener("joma:business-removed", clearBusinessCoupon);
  }, [setAppliedCode]);
  const deliveryDates = useMemo(() => buildDeliveryDates(deliverySchedule), [deliverySchedule]);
  const deliveryTimeRanges = useMemo(() => buildDeliveryTimeRanges(deliverySchedule), [deliverySchedule]);

  useEffect(() => {
    if (!appliedCode) return;
    let active = true;
    getActiveCatalog().then((catalog) => {
      if (!active) return;
      const productsById = new Map<string, Product>(catalog.map((product) => [product.id, product]));
      productsByIdRef.current = productsById;
      setAppliedCode(calculateDiscount(appliedCode, items, productsById));
    });
    return () => { active = false; };
  }, [items, appliedCode?.code, appliedCode?.percentage, setAppliedCode]);

  const applyDiscount = async (codeOverride?: string) => {
    setApplyingDiscount(true);
    setDiscountError("");
    window.sessionStorage.removeItem("joma.pendingCoupon");
    try {
      const catalog = await getActiveCatalog();
      const productsById = new Map<string, Product>(catalog.map((product) => [product.id, product]));
      productsByIdRef.current = productsById;
      setAppliedCode(await validateDiscountCode(codeOverride || discountInput, items, productsById, user?.uid, !items.length));
      setDiscountInput("");
    } catch (nextError) {
      setDiscountError(nextError instanceof Error ? nextError.message : "No pudimos aplicar el código.");
    } finally {
      setApplyingDiscount(false);
    }
  };

  useEffect(() => {
    const pendingCoupon = window.sessionStorage.getItem("joma.pendingCoupon");
    if (applyingDiscount || !pendingCoupon) return;
    if (appliedCode?.code === pendingCoupon) {
      window.sessionStorage.removeItem("joma.pendingCoupon");
      return;
    }
    if (appliedCode) setAppliedCode(null);
    setDiscountInput(pendingCoupon);
    void applyDiscount(pendingCoupon);
  }, [items.length, appliedCode?.code]);

  useEffect(() => {
    const selectCoupon = (event: Event) => {
      const code = String((event as CustomEvent<string>).detail || "").trim();
      if (!code) return;
      setAppliedCode(null);
      setDiscountError("");
      setDiscountInput(code);
      window.sessionStorage.setItem("joma.pendingCoupon", code);
      void applyDiscount(code);
    };
    window.addEventListener("joma:coupon-selected", selectCoupon);
    return () => window.removeEventListener("joma:coupon-selected", selectCoupon);
  }, [items, user?.uid]);

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

  const focusCheckoutField = (id: string) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id) as HTMLElement | null;
      target?.focus();
      target?.scrollIntoView({ block: "center" });
    });
  };

  const submit = async () => {
    if (!minimumCompleted) {
      setError(`Te faltan ${money.format(minimumRemaining)} para alcanzar el mínimo de compra.`);
      return;
    }
    const selectedDeliveryDate = deliveryDates.find((date) => date.value === deliveryDate);
    if (!selectedDeliveryDate || !deliveryTimeRange) {
      setError("Elegí el día y la franja horaria para recibir el pedido.");
      focusCheckoutField(!selectedDeliveryDate ? "checkout-delivery-first-day" : "checkout-delivery-time");
      return;
    }
    if (!paymentMethod) {
      setError("Elegí cómo vas a abonar el pedido.");
      focusCheckoutField("checkout-payment-cash");
      return;
    }
    const customer = {
      nombre: form.nombre.trim(), telefono: form.telefono.trim(), direccion: form.direccion.trim(), nota: form.nota.trim(), ubicacion: deliveryLocation,
    };
    if (!customer.nombre || !customer.telefono || !customer.direccion) {
      setError("Completá nombre, teléfono y dirección para confirmar la compra.");
      focusCheckoutField(!customer.nombre ? "checkout-name" : !customer.telefono ? "checkout-phone" : "checkout-address");
      return;
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
      const catalog = await getActiveCatalog();
      const productsById = new Map<string, Product>(catalog.map((product) => [product.id, product]));
      productsByIdRef.current = productsById;
      const verifiedCode = appliedCode ? await validateDiscountCode(appliedCode.code, items, productsById, user?.uid) : null;
      if (verifiedCode) setAppliedCode(verifiedCode);
      const result = await submitCheckoutOrder({
        user,
        customer: { ...customer, preventistaReferido: savedProfile?.preventistaReferido || "" },
        cartItems: items,
        productsById,
        discountCode: verifiedCode,
        requestId: orderRequestId.current,
        delivery: {
          date: selectedDeliveryDate.value,
          dateLabel: selectedDeliveryDate.label,
          timeRange: deliveryTimeRange,
        },
        paymentMethod,
        checkoutSettings,
      });
      const analyticsItems = items.map((item) => ({ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: item.qty, discount: Math.max(0, Number(item.listPrice || item.price) - item.price) }));
      trackEcommerce("add_shipping_info", { value: checkoutTotal, shipping_tier: `${selectedDeliveryDate.value}:${deliveryTimeRange}`, items: analyticsItems }, result.id);
      trackEcommerce("add_payment_info", { value: checkoutTotal, payment_type: paymentMethod, items: analyticsItems }, result.id);
      const attribution = getCampaignAttribution();
      trackEcommerce("purchase", { transaction_id: result.id, value: checkoutTotal, coupon: verifiedCode?.code, shipping: checkoutSettings.freeShipping ? 0 : checkoutSettings.shippingCost, campaign_id: attribution?.campaignId, campaign_name: attribution?.campaignName, advertiser: attribution?.advertiser, creative_name: attribution?.creativeName, creative_slot: attribution?.creativeSlot, attribution_type: attribution?.attributionType, items: analyticsItems.map((item) => attribution ? { ...item, promotion_id: attribution.campaignId, promotion_name: attribution.campaignName, creative_name: attribution.creativeName, creative_slot: attribution.creativeSlot } : item) }, result.id);
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
      clear(); setAppliedCode(null); setCheckoutOpen(false); setSentWarning(""); setSent(true); setForm(EMPTY_FORM); setDeliveryLocation(null); setDeliveryDate(""); setDeliveryTimeRange(""); setPaymentMethod(""); orderRequestId.current = createRequestId();
    } catch (nextError) {
      submitCompleteRef.current = false;
      setSubmitProgress(0);
      setError(nextError instanceof Error ? nextError.message : "No pudimos enviar el pedido.");
    } finally { setSubmitting(false); }
  };

  if (!items.length && !sent) return <section className="empty-state">
    <div className="empty-icon"><Icon name="cart" /></div><h2>Tu carrito está esperando</h2><p>Agregá tus productos favoritos y los vas a encontrar acá.</p>
    {appliedCode ? <div className="empty-cart-coupon"><Icon name="ticket"/><div><strong>Cupón {appliedCode.code} disponible</strong><span>Se aplicará automáticamente cuando agregues productos.</span></div><button type="button" onClick={() => { setAppliedCode(null); setDiscountInput(""); setDiscountError(""); window.sessionStorage.removeItem("joma.pendingCoupon"); }}>Quitar</button></div> : discountInput || discountError ? <div className="empty-cart-coupon-form"><label htmlFor="empty-cart-coupon-input">Código de descuento</label><div><span><input id="empty-cart-coupon-input" value={discountInput} onChange={(event) => { setDiscountInput(event.target.value.toLocaleUpperCase("es-AR")); setDiscountError(""); }} />{discountInput ? <button type="button" className="coupon-input-clear" aria-label="Borrar código" onClick={() => { setDiscountInput(""); setDiscountError(""); window.sessionStorage.removeItem("joma.pendingCoupon"); }}><Icon name="close"/></button> : null}</span><button type="button" disabled={!discountInput.trim() || applyingDiscount} onClick={() => void applyDiscount()}>{applyingDiscount ? "Verificando…" : "Aplicar"}</button></div>{discountError ? <p role="alert">{discountError}</p> : null}</div> : null}
    <button type="button" className="primary-action" onClick={onContinue}>Explorar productos</button>
  </section>;

  return <>
    {sent ? <section className="order-success"><div className="success-check"><Icon name="check"/></div><h2>Pedido confirmado :)</h2><p>Nos comunicaremos con vos en breve, para coordinar la entrega y la forma de pago.<br/>Muchas gracias</p>{sentWarning ? <div className="checkout-error" role="status">{sentWarning}</div> : null}<button type="button" className="primary-action" onClick={() => window.location.reload()}>Volver al inicio</button></section> : <section className="cart-page">
      <div className="section-heading cart-heading"><div><span>Tu compra</span><h2>Carrito</h2><CartExpiryCountdown /></div><button type="button" className="clear-button" onClick={() => { items.forEach((item) => trackEcommerce("remove_from_cart", { value: item.price * item.qty, items: [{ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: item.qty }] })); clear(); }}><Icon name="trash" /> Vaciar</button></div>
      <div className="cart-list"><AnimatePresence initial={false}>{items.map((item) => { const remaining = getRemainingStock(items, item.productId, item.stockLimit); const canAdd = remaining === undefined || remaining >= getCartItemUnits({ ...item, qty: 1 }); const pricing = pricingByItem.get(item.id)!; const couponEligibleSubtotal = Number(appliedCode?.eligibleSubtotalByItem?.[item.id] || 0); const couponApplies = couponEligibleSubtotal > 0; return <motion.article layout exit={{ opacity: 0, x: 24 }} key={item.id} className={`cart-item ${couponApplies ? "has-coupon-discount" : ""}`}>
        <div className="cart-item-copy"><strong>{item.name}</strong><span>{item.label}</span><CartPriceBreakdown item={item} pricing={pricing} couponPercentage={appliedCode?.percentage} couponEligibleSubtotal={couponEligibleSubtotal} formatMoney={(value) => money.format(value)} /></div>
        <div className="cart-item-actions"><div className="stepper compact"><button type="button" onClick={() => { trackEcommerce("remove_from_cart", { value: item.price, items: [{ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: 1 }] }); decItem(item.id); }} aria-label={`Disminuir ${item.name}`}><Icon name="minus" /></button><output>{item.qty}</output><button type="button" onClick={() => { addItem({ id: item.id, productId: item.productId, name: item.name, brand: item.brand, category: item.category, variant: item.variant, label: item.label, price: item.price, listPrice: item.listPrice, discountPct: item.discountPct, unitPriceFinal: item.unitPriceFinal, unitsPerPack: item.unitsPerPack, stockLimit: item.stockLimit, promoPackQty: item.promoPackQty, promoPackUnitPrice: item.promoPackUnitPrice, offerMinQty: item.offerMinQty, offerUnitPrice: item.offerUnitPrice, offerAllowCoupons: item.offerAllowCoupons, offerMaxUnits: item.offerMaxUnits, offerUsedUnits: item.offerUsedUnits }, 1); trackEcommerce("add_to_cart", { value: item.price, items: [{ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: 1 }] }); }} aria-label={`Aumentar ${item.name}`} disabled={!canAdd}><Icon name="plus" /></button></div><button className="remove-button" type="button" onClick={() => { trackEcommerce("remove_from_cart", { value: item.price * item.qty, items: [{ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: item.qty }] }); removeItem(item.id); }}>Quitar</button></div>
      </motion.article>; })}</AnimatePresence></div>
      <div className="cart-checkout-footer">
      <div className="cart-discount-area">
      <div className={`cart-discount-module ${appliedCode ? "is-valid state-feedback" : discountError ? "is-invalid state-feedback" : ""}`}>
        <label htmlFor="cart-discount-input">Código de descuento</label>
        {appliedCode ? <div className="cart-discount-applied"><div><strong>{appliedCode.code}</strong><span>{appliedCode.percentage}% aplicado</span></div><button type="button" onClick={() => { setAppliedCode(null); setDiscountError(""); window.sessionStorage.removeItem("joma.pendingCoupon"); }}>Quitar</button></div> : <div className="cart-discount-form"><span className="coupon-input-wrap"><input id="cart-discount-input" value={discountInput} onChange={(event) => { const value = event.target.value.toLocaleUpperCase("es-AR"); setDiscountInput(value); if (!value.trim()) setDiscountError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void applyDiscount(); }} placeholder="Ingresá tu código" autoCapitalize="characters" maxLength={24}/>{discountError && discountInput ? <button type="button" className="coupon-input-clear" aria-label="Borrar código" onClick={() => { setDiscountInput(""); setDiscountError(""); window.sessionStorage.removeItem("joma.pendingCoupon"); }}><Icon name="close"/></button> : null}</span><button type="button" onClick={() => void applyDiscount()} disabled={applyingDiscount || !discountInput.trim()}>{applyingDiscount ? "Aplicando..." : "Aplicar"}</button></div>}
        {discountError ? <p className="cart-discount-error" role="alert">{discountError}</p> : null}
      </div>
      <aside className={`cart-benefit-summary ${appliedCode ? "is-active" : ""}`} aria-live="polite">{appliedCode ? <><span>Beneficio aplicado</span><strong>Cupón porcentual · {appliedCode.percentage}%</strong><dl><div><dt>Código</dt><dd>{appliedCode.code}</dd></div><div><dt>Productos alcanzados</dt><dd>{appliedCode.eligibleItemIds.length}</dd></div><div><dt>Descuento obtenido</dt><dd>− {money.format(appliedCode.discountAmount)}</dd></div></dl></> : <><span>Beneficio del pedido</span><strong>Sin cupón aplicado</strong><p>Cuando ingreses un código válido, acá vas a ver el tipo y el descuento obtenido.</p></>}</aside>
      </div>
      <div className="cart-summary">
        <div className="cart-summary-shipping"><span>Envío</span><span>{checkoutSettings.freeShipping ? <><s>{money.format(checkoutSettings.shippingCost)}</s><b>Gratis</b></> : <b>{money.format(checkoutSettings.shippingCost)}</b>}</span></div>
        <div className="cart-summary-total"><span>Total estimado</span><strong>{money.format(checkoutTotal)}</strong></div>
        <div className={`cart-minimum ${minimumCompleted ? "is-complete" : ""}`} aria-live="polite">
          <div><span>Mínimo de compra</span><b>{money.format(checkoutSettings.minimumOrder)}</b></div>
          <p>{minimumCompleted ? "Mínimo de compra completado" : `Te faltan ${money.format(minimumRemaining)} para completar el mínimo de compra`}</p>
          <span className="cart-minimum-track" aria-hidden="true"><i style={{ transform: `scaleX(${minimumProgress / 100})` }} /></span>
        </div>
        <button type="button" className={`checkout-button ${user ? "" : "is-login"}`} disabled={!minimumCompleted} onClick={() => {
        if (!user && onRequireAuth) { onRequireAuth(); return; }
        trackEcommerce("begin_checkout", { value: checkoutTotal, coupon: appliedCode?.code, items: items.map((item) => ({ item_id: item.productId, item_name: item.name, item_brand: item.brand, item_category: item.category, item_variant: item.variant, price: item.price, quantity: item.qty })) }, `${items.map((item) => `${item.id}:${item.qty}`).join("|")}:${checkoutTotal}`);
        setError(""); setCheckoutOpen(true);
      }}>{minimumCompleted ? (user ? "Confirmar compra" : "Iniciar sesión para confirmar") : `Faltan ${money.format(minimumRemaining)}`}</button>
      </div>
      </div>
    </section>}

    <AnimatePresence>{checkoutOpen && !mapOpen ? <><motion.button type="button" className="checkout-backdrop" aria-label="Cerrar confirmación" onClick={() => !submitting && setCheckoutOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.section className="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkout-title" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: .26, ease: [0.22, 1, 0.36, 1] }}><div className="checkout-head"><div><span>Último paso</span><h2 id="checkout-title">Confirmar compra</h2></div><button type="button" onClick={() => setCheckoutOpen(false)} disabled={submitting} aria-label="Cerrar"><Icon name="close"/></button></div><div className="checkout-body">
      {profileLoading ? <div className="checkout-notice"><span className="tiny-spinner"/> Completando tus datos guardados…</div> : null}
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <fieldset className="checkout-delivery" disabled={submitting || deliveryLoading}>
        <h3>¿Cuándo querés recibir tu compra?</h3>
        <p>Elegí desde mañana. Los domingos no realizamos entregas.</p>
        {deliveryLoading ? <div className="checkout-notice"><span className="tiny-spinner"/> Consultando horarios…</div> : <>
          <div className="checkout-delivery-days">
            {deliveryDates.map((date, index) => <button id={index === 0 ? "checkout-delivery-first-day" : undefined} type="button" className={deliveryDate === date.value ? "is-active" : ""} onClick={() => setDeliveryDate(date.value)} aria-pressed={deliveryDate === date.value} key={date.value}>{date.shortLabel}</button>)}
          </div>
          <label className="checkout-delivery-time"><span>Franja de entrega</span><select id="checkout-delivery-time" value={deliveryTimeRange} onChange={(event) => setDeliveryTimeRange(event.target.value)}>
            {deliveryTimeRanges.map((timeRange) => <option value={timeRange} key={timeRange}>{timeRange}</option>)}
          </select></label>
        </>}
      </fieldset>
      <section className={`checkout-payment ${submitting ? "is-disabled" : ""}`} role="group" aria-labelledby="checkout-payment-title" aria-describedby={paymentMethod ? "checkout-payment-note" : undefined}>
        <h3 id="checkout-payment-title">¿Cómo vas a abonar?</h3>
        <div className="checkout-payment-options">
          <button id="checkout-payment-cash" type="button" disabled={submitting} className={paymentMethod === "cash" ? "is-active" : ""} aria-pressed={paymentMethod === "cash"} onClick={() => { setPaymentMethod("cash"); setError(""); }}><span>Efectivo</span><span className="checkout-payment-mark" aria-hidden="true">{paymentMethod === "cash" ? "✓" : ""}</span></button>
          <button type="button" disabled={submitting} className={paymentMethod === "transfer" ? "is-active" : ""} aria-pressed={paymentMethod === "transfer"} onClick={() => { setPaymentMethod("transfer"); setError(""); }}><span>Transferencia</span><span className="checkout-payment-mark" aria-hidden="true">{paymentMethod === "transfer" ? "✓" : ""}</span></button>
        </div>
        {paymentMethod ? <p id="checkout-payment-note" className="checkout-payment-note">Abonará al momento de recibir la mercadería.</p> : null}
      </section>
      <label><span>Nombre y apellido</span><input id="checkout-name" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} autoComplete="name" placeholder="Tu nombre"/></label>
      <label><span>Teléfono</span><input id="checkout-phone" value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} autoComplete="tel" inputMode="tel" placeholder="WhatsApp o teléfono"/></label>
      <label><span>Dirección de entrega</span><input id="checkout-address" value={form.direccion} onChange={(event) => { setForm((current) => ({ ...current, direccion: event.target.value })); setDeliveryLocation(null); }} autoComplete="street-address" placeholder="Calle, número y localidad"/></label>
      <button type="button" className={`checkout-location-button ${deliveryLocation ? "is-marked" : ""}`} onClick={() => setMapOpen(true)} disabled={submitting}><span aria-hidden="true">📍</span><span>{deliveryLocation ? "Ubicación guardada" : "Marcar punto de entrega"}</span>{deliveryLocation ? <small>{deliveryLocation.lat.toFixed(5)}, {deliveryLocation.lng.toFixed(5)}</small> : null}</button>
      <label><span>Nota <em>Opcional</em></span><textarea value={form.nota} onChange={(event) => setForm((current) => ({ ...current, nota: event.target.value }))} rows={3} placeholder="Aclaraciones para el pedido"/></label>
    </div><div className="checkout-actions"><button type="button" className="checkout-cancel" onClick={() => setCheckoutOpen(false)} disabled={submitting}>Cancelar</button><button type="button" className={`checkout-submit ${submitting ? "is-submitting" : ""}`} onClick={submit} disabled={submitting || profileLoading || deliveryLoading} aria-label={submitting ? `Enviando pedido, ${submitProgress}% completado` : "Enviar pedido"} aria-busy={submitting}>{submitting ? <><span className="checkout-submit-progress" style={{ transform: `scaleX(${submitProgress / 100})` }} aria-hidden="true"/><span className="checkout-submit-label">Enviando pedido...</span></> : "Enviar pedido"}</button></div></motion.section></> : null}</AnimatePresence>
    <MapPickerModal open={mapOpen} initial={deliveryLocation} center={deliveryLocation} initialQuery={form.direccion} onClose={() => setMapOpen(false)} onPick={setDeliveryLocation}/>
  </>;
}
