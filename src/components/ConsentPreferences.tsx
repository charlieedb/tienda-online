import { useEffect, useState } from "react";
import { getConsentPreferences, saveConsentPreferences } from "@/lib/analytics";

export function ConsentPreferences() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [advertising, setAdvertising] = useState(false);
  useEffect(() => {
    const current = getConsentPreferences();
    if (current) { setAnalytics(current.analytics); setAdvertising(current.advertising); } else setOpen(true);
    const show = () => { const saved = getConsentPreferences(); setAnalytics(saved?.analytics ?? true); setAdvertising(saved?.advertising ?? false); setCustomizing(true); setOpen(true); };
    window.addEventListener("joma:open-privacy-preferences", show);
    return () => window.removeEventListener("joma:open-privacy-preferences", show);
  }, []);
  const save = (nextAnalytics: boolean, nextAdvertising: boolean) => { saveConsentPreferences({ analytics: nextAnalytics, advertising: nextAdvertising }); setOpen(false); setCustomizing(false); };
  if (!open) return null;
  return <div className="consent-layer" role="dialog" aria-modal="true" aria-labelledby="consent-title"><section className="consent-card"><div className="consent-copy"><span>Tu privacidad</span><h2 id="consent-title">Elegí cómo medimos tu experiencia</h2><p>Usamos medición para mejorar la tienda. La publicidad nos permite conocer el rendimiento de campañas, sin enviar tu nombre, teléfono, dirección ni ubicación.</p></div>{customizing ? <div className="consent-options"><label><span><strong>Necesarias</strong><small>Seguridad, sesión y carrito.</small></span><input type="checkbox" checked disabled /></label><label><span><strong>Analítica</strong><small>Visitas, búsquedas y embudo de compra.</small></span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /></label><label><span><strong>Publicidad</strong><small>Impresiones, clics y atribución de campañas.</small></span><input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} /></label></div> : null}<div className="consent-actions">{customizing ? <button type="button" className="btn ghost" onClick={() => save(analytics, advertising)}>Guardar preferencias</button> : <button type="button" className="btn ghost" onClick={() => setCustomizing(true)}>Personalizar</button>}<button type="button" className="btn ghost" onClick={() => save(false, false)}>Rechazar opcionales</button><button type="button" className="btn primary" onClick={() => save(true, true)}>Aceptar todo</button></div><a href="/privacidad">Política de privacidad</a></section></div>;
}

export function PrivacyPreferencesButton() {
  return <button type="button" className="privacy-preferences-button" onClick={() => window.dispatchEvent(new Event("joma:open-privacy-preferences"))}>Preferencias de privacidad</button>;
}
