import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { enablePushNotifications, syncPushNotificationRegistration } from "@/lib/pushNotifications";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function canShowIosInstallGuide() {
  const preview = new URLSearchParams(window.location.search).get("previewInstallIos") === "1";
  return (preview || isIosDevice()) && !isStandalone();
}

export function PwaInstallGuide() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const preview = new URLSearchParams(window.location.search).get("previewInstallIos") === "1";
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => !preview && window.localStorage.getItem("joma.installGuideDismissed") === "1");
  const [pushState, setPushState] = useState<"idle" | "loading" | "enabled" | "blocked">(() => Notification.permission === "granted" ? "enabled" : Notification.permission === "denied" ? "blocked" : "idle");
  const [message, setMessage] = useState("");
  const showIosGuide = preview || isIosDevice();

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(isStandalone());
    media.addEventListener?.("change", update);
    window.addEventListener("appinstalled", update);
    return () => { media.removeEventListener?.("change", update); window.removeEventListener("appinstalled", update); };
  }, []);

  useEffect(() => {
    const openFromMenu = () => {
      if (isStandalone()) return;
      setDismissed(false);
      setOpen(true);
    };
    window.addEventListener("joma:open-install-guide", openFromMenu);
    return () => window.removeEventListener("joma:open-install-guide", openFromMenu);
  }, []);

  useEffect(() => {
    if (!user || Notification.permission !== "granted") return;
    void syncPushNotificationRegistration(user).then((synced) => {
      if (synced) setPushState("enabled");
    }).catch(() => {});
  }, [user]);

  if (!showIosGuide || dismissed || installed) return null;

  const close = () => {
    setOpen(false);
    setDismissed(true);
    if (!preview) window.localStorage.setItem("joma.installGuideDismissed", "1");
  };

  const enableNotifications = async () => {
    if (!user) { setMessage("Iniciá sesión antes de activar las notificaciones."); return; }
    setPushState("loading");
    setMessage("");
    try {
      await enablePushNotifications(user);
      setPushState("enabled");
      setMessage("Notificaciones activadas en este iPhone.");
    } catch (error) {
      setPushState(Notification.permission === "denied" ? "blocked" : "idle");
      setMessage(error instanceof Error ? error.message : "No pudimos activar las notificaciones.");
    }
  };

  return <>
    {!open ? <button type="button" className="pwa-guide-launcher" onClick={() => setOpen(true)}><span className="pwa-guide-launcher__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg></span><span><strong>Instalar JOMA</strong><small>Tienda en tu inicio</small></span></button> : null}
    {typeof document !== "undefined" ? <AnimatePresence>{open ? <motion.div className="pwa-guide-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18 }}>
      <motion.section className="pwa-guide" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} transition={{ duration: reduceMotion ? .01 : .22, ease: [0.22, 1, 0.36, 1] }}>
        <div className="pwa-guide__head"><img src="/icon-192.png" alt="" width="56" height="56"/><div><span>Guía para iPhone</span><h2 id="pwa-guide-title">Instalá JOMA Express</h2></div><button type="button" onClick={close} aria-label="Cerrar guía">×</button></div>
        {!installed || preview ? <><p className="pwa-guide__intro">Seguí estos pasos para tener la tienda en la pantalla de inicio de tu iPhone.</p><ol className="pwa-guide__steps"><li><b>1</b><span><strong>Tocá los tres puntos</strong><small>Están en la barra del navegador.</small></span><span className="pwa-guide__more" aria-hidden="true">•••</span></li><li><b>2</b><span><strong>Tocá “Compartir”</strong><small>Se abrirán las opciones disponibles.</small></span><span className="pwa-guide__share" aria-hidden="true">↑</span></li><li><b>3</b><span><strong>Buscá “Agregar a inicio”</strong><small>Desplazate hacia abajo si no aparece a primera vista.</small></span></li><li><b>4</b><span><strong>Confirmá con “Agregar”</strong><small>JOMA aparecerá como un ícono en tu pantalla de inicio.</small></span></li></ol><div className="pwa-guide__note">Agregá la tienda manualmente para tenerla siempre a mano y entrar con un solo toque.</div></> : <div className="pwa-guide__installed"><span>✓</span><div><strong>JOMA ya está instalada</strong><p>Ahora podés activar los avisos para recibir cupones y novedades.</p></div></div>}
        {(installed && !preview) ? <div className="pwa-guide__notifications"><button type="button" disabled={pushState === "loading" || pushState === "enabled" || pushState === "blocked"} onClick={() => void enableNotifications()}>{pushState === "loading" ? "Activando…" : pushState === "enabled" ? "Notificaciones activadas" : pushState === "blocked" ? "Permiso bloqueado" : "Activar notificaciones"}</button>{message ? <small role="status">{message}</small> : null}{pushState === "blocked" ? <small>Habilitalas desde Ajustes → Notificaciones → JOMA Express.</small> : null}</div> : <button type="button" className="pwa-guide__understood" onClick={close}>Entendido</button>}
      </motion.section>
    </motion.div> : null}</AnimatePresence> : null}
  </>;
}
