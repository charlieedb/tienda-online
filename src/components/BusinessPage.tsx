import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth } from "@/auth/AuthProvider";
import {
  getCachedUserProfile,
  getBusinessRegistrationDraft,
  refreshUserProfile,
  removeBusinessFromUserProfile,
  saveBusinessRegistrationDraft,
  upsertUserProfile,
  type BusinessProfile,
} from "@/lib/userProfile";
import { Icon } from "./Icons";

const EMPTY_BUSINESS: BusinessProfile = {
  fantasyName: "",
  ownerName: "",
  address: "",
  city: "",
  businessType: "",
  cuit: "",
  phone: "",
};

type BusinessField = keyof BusinessProfile;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCuit(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return verifier === Number(digits[10]);
}

function getBusinessErrors(business: BusinessProfile): Partial<Record<BusinessField, string>> {
  const errors: Partial<Record<BusinessField, string>> = {};
  if (business.fantasyName.trim().length < 2) errors.fantasyName = "Ingresá el nombre de fantasía.";
  if (business.ownerName.trim().length < 3) errors.ownerName = "Ingresá el nombre completo del dueño.";
  if (!business.businessType) errors.businessType = "Seleccioná el tipo de negocio.";
  const phoneDigits = onlyDigits(business.phone);
  if (phoneDigits.length < 8 || phoneDigits.length > 15) errors.phone = "Ingresá un teléfono válido, de 8 a 15 dígitos.";
  if (business.address.trim().length < 5) errors.address = "Ingresá la dirección completa del comercio.";
  if (business.cuit && !isValidCuit(business.cuit)) errors.cuit = "El CUIT debe tener 11 dígitos y un verificador válido.";
  return errors;
}

export function BusinessPage({ onLogin, onBackToStore }: { onLogin: (mode?: "login" | "signup") => void; onBackToStore: () => void }) {
  const { user } = useAuth();
  const [business, setBusiness] = useState(EMPTY_BUSINESS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<BusinessField, boolean>>>({});
  const [hasRegisteredBusiness, setHasRegisteredBusiness] = useState(false);
  const [editing, setEditing] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fieldErrors = getBusinessErrors(business);

  useEffect(() => {
    if (!confirmingDelete) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setConfirmingDelete(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", closeOnEscape); };
  }, [confirmingDelete, deleting]);

  useEffect(() => {
    if (!user) {
      setBusiness(getBusinessRegistrationDraft() ?? EMPTY_BUSINESS);
      return;
    }
    const cached = getCachedUserProfile(user.uid);
    const draft = getBusinessRegistrationDraft();
    if (cached?.accountType === "business" && cached.business) {
      setHasRegisteredBusiness(true);
      setEditing(false);
    }
    setBusiness(cached?.business ?? draft ?? { ...EMPTY_BUSINESS, ownerName: cached?.displayName || user.displayName || "", phone: cached?.telefono || "", address: cached?.direcciones?.[0]?.direccion || "", city: cached?.direcciones?.[0]?.localidad || "" });
    let active = true;
    refreshUserProfile(user.uid).then((profile) => {
      if (!active || !profile) return;
      if (profile.accountType === "business" && profile.business) {
        setHasRegisteredBusiness(true);
        setEditing(false);
      }
      setBusiness(profile.business ?? draft ?? { ...EMPTY_BUSINESS, ownerName: profile.displayName || user.displayName || "", phone: profile.telefono || "", address: profile.direcciones?.[0]?.direccion || "", city: profile.direcciones?.[0]?.localidad || "" });
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const handleRegistered = (event: Event) => {
      const nextBusiness = (event as CustomEvent<BusinessProfile>).detail;
      if (nextBusiness) setBusiness(nextBusiness);
      setHasRegisteredBusiness(true);
      setEditing(false);
      setSaved(true);
    };
    window.addEventListener("joma:business-registered", handleRegistered);
    return () => window.removeEventListener("joma:business-registered", handleRegistered);
  }, []);

  const update = (key: keyof BusinessProfile, value: string) => {
    setBusiness((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  };

  const fieldState = (key: BusinessField) => {
    const hasValue = Boolean(business[key].trim());
    const invalid = Boolean(fieldErrors[key]) && (submitted || touched[key]);
    return invalid ? "is-invalid" : hasValue && !fieldErrors[key] ? "is-valid" : "";
  };

  const fieldError = (key: BusinessField) => fieldErrors[key] && (submitted || touched[key])
    ? <small className="business-field-error">{fieldErrors[key]}</small>
    : null;

  const touch = (key: BusinessField) => setTouched((current) => ({ ...current, [key]: true }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(fieldErrors).length) {
      setError("Revisá los campos marcados para continuar.");
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".business-fields .is-invalid")?.focus());
      return;
    }
    if (!user) {
      saveBusinessRegistrationDraft(business);
      onLogin("signup");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const current = getCachedUserProfile(user.uid);
      await upsertUserProfile({
        uid: user.uid,
        email: user.email,
        username: current?.username || user.email?.split("@")[0] || `usuario_${user.uid.slice(0, 8)}`,
        dni: current?.dni || "",
        displayName: current?.displayName || user.displayName,
        nombre: current?.nombre || "",
        apellido: current?.apellido || "",
        telefono: current?.telefono || business.phone.trim(),
        preventistaReferido: current?.preventistaReferido || "",
        notes: current?.notes || "",
        direcciones: current?.direcciones,
        accountType: "business",
        business,
      });
      setSaved(true);
      setHasRegisteredBusiness(true);
      setEditing(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos registrar el comercio.");
    } finally {
      setSaving(false);
    }
  };

  const removeBusiness = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await removeBusinessFromUserProfile(user.uid);
      window.localStorage.removeItem("joma.pendingCoupon");
      window.dispatchEvent(new CustomEvent("joma:business-removed"));
      setBusiness(EMPTY_BUSINESS);
      setHasRegisteredBusiness(false);
      setEditing(true);
      setSaved(false);
      setSubmitted(false);
      setTouched({});
      setConfirmingDelete(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos eliminar el comercio.");
    } finally {
      setDeleting(false);
    }
  };

  return <section className="business-page">
    <div className="business-backdrop" aria-hidden="true">
      <svg viewBox="0 0 120 120"><path d="M18 52h84v52H18zM12 52l10-28h76l10 28M12 52c0 9 14 9 14 0 0 9 14 9 14 0 0 9 14 9 14 0 0 9 14 9 14 0 0 9 14 9 14 0 0 9 14 9 14 0M43 104V76h34v28" /></svg>
      <svg viewBox="0 0 120 120"><path d="M20 38h80v66H20zM14 38l12-22h68l12 22M14 38h92M34 104V69h22v35M68 60h20v18H68z" /></svg>
      <svg viewBox="0 0 120 120"><path d="m18 42 42-22 42 22-42 22-42-22Zm0 0v42l42 22 42-22V42M60 64v42M39 31l42 22" /></svg>
    </div>
    <div className="business-hero">
      <div className="business-hero-icon"><Icon name="store" /></div>
      <div><h1>¡Registrá tu comercio y aprovechá precios exclusivos!</h1><p>Armá tu pedido por unidad y elegí exactamente lo que necesitás para tu negocio.</p>
        <div className="business-hero-benefits" aria-label="Beneficios para comercios">
          <div><Icon name="grid" /><span>Compra surtida: combiná productos y cantidades.</span></div>
          <div><Icon name="spark" /><span>Beneficios exclusivos: promociones para comercios.</span></div>
          <div><Icon name="check" /><span>Perfil comercial: tu cuenta se identifica como comercio.</span></div>
        </div>
      </div>
    </div>

    {hasRegisteredBusiness && !editing ? <motion.section className={`business-registered ${saved ? "is-new" : ""}`} initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .35, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
      <motion.div className="business-registered-icon" initial={saved ? { scale: .65, rotate: -10 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}><Icon name="check" /></motion.div>
      <div><span>{saved ? "Registro completado" : "Comercio adherido"}</span><h2>{saved ? "¡Gracias por registrarte!" : business.fantasyName}</h2><p>{saved ? "Vas a recibir novedades dentro de muy poco tiempo." : "Tu comercio ya está asociado a esta cuenta. Podés actualizar sus datos cuando lo necesites."}</p></div>
      {!saved ? <dl><div><dt>Responsable</dt><dd>{business.ownerName}</dd></div><div><dt>Tipo de negocio</dt><dd>{business.businessType}</dd></div><div><dt>Dirección</dt><dd>{[business.address, business.city].filter(Boolean).join(", ")}</dd></div></dl> : null}
      <div className="business-registered-actions">
        <button type="button" className="business-back-store" onClick={onBackToStore}>Volver a la tienda</button>
        <button type="button" className="business-edit-link" onClick={() => { setEditing(true); setSaved(false); setSubmitted(false); setTouched({}); }}>Editar mi comercio</button>
        <button type="button" className="business-delete-link" onClick={() => setConfirmingDelete(true)}>Eliminar comercio</button>
      </div>
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
    </motion.section> : <form className="business-form" onSubmit={save} noValidate>
      <div className="business-form-heading"><div><strong>{business.fantasyName ? "Datos de tu comercio" : "Registrá tu comercio"}</strong><p>Los campos con * son obligatorios.</p></div>{saved ? <span><Icon name="check" /> Comercio registrado</span> : null}</div>
      {user && !user.emailVerified ? <div className="business-verification-note"><Icon name="spark" /><div><strong>Confirmá tu correo</strong><span>Tu comercio ya está asociado a esta cuenta. Revisá tu email para verificarla y recibir futuros beneficios.</span></div></div> : null}
      {!user ? <div className="business-account-note"><div><strong>¿Ya tenés una cuenta?</strong><span>Completá los datos o iniciá sesión para asociar este comercio a tu usuario.</span></div><button type="button" onClick={() => { saveBusinessRegistrationDraft(business); onLogin("login"); }}>Iniciar sesión</button></div> : null}
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <div className="business-fields">
        <label><span>Nombre de fantasía *</span><input className={fieldState("fantasyName")} aria-invalid={fieldState("fantasyName") === "is-invalid"} value={business.fantasyName} onBlur={() => touch("fantasyName")} onChange={(event) => update("fantasyName", event.target.value)} />{fieldError("fantasyName")}</label>
        <label><span>Nombre del dueño *</span><input className={fieldState("ownerName")} aria-invalid={fieldState("ownerName") === "is-invalid"} autoComplete="name" value={business.ownerName} onBlur={() => touch("ownerName")} onChange={(event) => update("ownerName", event.target.value)} />{fieldError("ownerName")}</label>
        <label><span>Tipo de negocio *</span><select className={fieldState("businessType")} aria-invalid={fieldState("businessType") === "is-invalid"} value={business.businessType} onBlur={() => touch("businessType")} onChange={(event) => update("businessType", event.target.value)}><option value="">Seleccionar</option><option>Kiosco</option><option>Almacén</option><option>Minimercado</option><option>Autoservicio</option><option>Supermercado</option><option>Gastronomía</option><option>Otro</option></select>{fieldError("businessType")}</label>
        <label><span>Teléfono *</span><input className={fieldState("phone")} aria-invalid={fieldState("phone") === "is-invalid"} autoComplete="tel" inputMode="tel" value={business.phone} onBlur={() => touch("phone")} onChange={(event) => update("phone", event.target.value)} />{fieldError("phone")}</label>
        <label className="business-field-wide"><span>Dirección del comercio *</span><input className={fieldState("address")} aria-invalid={fieldState("address") === "is-invalid"} autoComplete="street-address" value={business.address} onBlur={() => touch("address")} onChange={(event) => update("address", event.target.value)} />{fieldError("address")}</label>
        <label><span>Localidad</span><input className={fieldState("city")} autoComplete="address-level2" value={business.city} onBlur={() => touch("city")} onChange={(event) => update("city", event.target.value)} /></label>
        <label><span>CUIT <em>Opcional</em></span><input className={fieldState("cuit")} aria-invalid={fieldState("cuit") === "is-invalid"} inputMode="numeric" maxLength={11} value={business.cuit} onBlur={() => touch("cuit")} onChange={(event) => update("cuit", onlyDigits(event.target.value).slice(0, 11))} />{fieldError("cuit")}</label>
      </div>
      <button className={`business-save ${saved ? "is-saved" : ""}`} type="submit" disabled={saving}>{saving ? "Guardando…" : saved ? "Datos guardados" : hasRegisteredBusiness ? "Guardar cambios" : user ? "Registrar mi comercio" : "Continuar y crear mi cuenta"}</button>
      {hasRegisteredBusiness ? <button className="business-edit-cancel" type="button" onClick={() => { setEditing(false); setError(""); }}>Cancelar edición</button> : null}
    </form>}
    {typeof document !== "undefined" ? createPortal(<AnimatePresence>{confirmingDelete ? <motion.div className="business-delete-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirmingDelete(false); }}><motion.div className="business-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="business-delete-title" aria-describedby="business-delete-description" initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} transition={{ duration: .2, ease: [0.22, 1, 0.36, 1] }}><div className="business-delete-icon"><Icon name="trash" /></div><div className="business-delete-copy"><span>Acción permanente</span><h2 id="business-delete-title">¿Eliminar este comercio?</h2><p id="business-delete-description">Se quitarán los datos comerciales de tu perfil. Tu cuenta y tus pedidos se conservan, y podrás registrar otro comercio más adelante.</p></div><div className="business-delete-dialog-actions"><button type="button" className="business-delete-cancel" disabled={deleting} autoFocus onClick={() => setConfirmingDelete(false)}>Conservar comercio</button><button type="button" className="business-delete-confirm-button" disabled={deleting} onClick={() => void removeBusiness()}>{deleting ? <><span className="business-delete-spinner" aria-hidden="true"/> Eliminando…</> : <><Icon name="trash" /> Eliminar comercio</>}</button></div></motion.div></motion.div> : null}</AnimatePresence>, document.body) : null}
  </section>;
}
