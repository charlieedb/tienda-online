import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { requestPushNotificationPermission, syncPushNotificationRegistration } from "@/lib/pushNotifications";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstalledNotificationGuide() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const supported = "Notification" in window && "serviceWorker" in navigator;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState<NotificationPermission>(() => supported ? Notification.permission : "denied");

  useEffect(() => {
    if (!supported || !isStandalone()) return;
    if (Notification.permission === "granted") {
      if (user) void syncPushNotificationRegistration(user).catch(() => {});
      return;
    }
    if (window.localStorage.getItem("joma.notificationGuideDismissed") === "1") return;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [user, supported]);

  useEffect(() => {
    const openFromMenu = () => {
      if (!supported || !isStandalone() || Notification.permission === "granted") return;
      setPermission(Notification.permission);
      setMessage("");
      setOpen(true);
    };
    window.addEventListener("joma:open-notification-guide", openFromMenu);
    return () => window.removeEventListener("joma:open-notification-guide", openFromMenu);
  }, [supported]);

  if (!supported || !isStandalone() || permission === "granted") return null;

  const close = () => {
    setOpen(false);
    window.localStorage.setItem("joma.notificationGuideDismissed", "1");
  };

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      await requestPushNotificationPermission();
      setOpen(false);
      setPermission("granted");
      window.localStorage.removeItem("joma.notificationGuideDismissed");
      if (user) void syncPushNotificationRegistration(user).catch(() => {});
    } catch (error) {
      const nextPermission = Notification.permission;
      setPermission(nextPermission);
      if (nextPermission === "denied") {
        setOpen(false);
        window.localStorage.setItem("joma.notificationGuideDismissed", "1");
      } else {
        setMessage(error instanceof Error ? error.message : "No pudimos activar las notificaciones.");
      }
    } finally {
      setBusy(false);
    }
  };

  return <AnimatePresence>{open ? <motion.div className="pwa-guide-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18 }}>
    <motion.section className="pwa-guide installed-notification-guide" role="dialog" aria-modal="true" aria-labelledby="installed-notification-title" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} transition={{ duration: reduceMotion ? .01 : .22, ease: [0.22, 1, 0.36, 1] }}>
      <div className="pwa-guide__head"><span className="android-install-guide__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><div><span>Un último paso</span><h2 id="installed-notification-title">¿Querés recibir avisos?</h2></div><button type="button" onClick={close} aria-label="Cerrar">×</button></div>
      <p className="pwa-guide__intro">Podemos avisarte cuando recibas un cupón o haya una novedad importante.</p>
      <div className="android-install-privacy"><strong>Vos decidís</strong><p>Es opcional y podés desactivarlo cuando quieras. JOMA no solicita acceso a fotos, contactos ni archivos.</p></div>
      {permission === "denied" ? <div className="notification-permission-blocked"><strong>El permiso está bloqueado</strong><p>Habilitá las notificaciones desde Ajustes → Notificaciones → JOMA Express.</p></div> : <button type="button" className="android-install-confirm" disabled={busy} onClick={() => void enable()}>{busy ? "Activando…" : "Activar notificaciones"}</button>}
      {message ? <div className="android-install-message" role="status">{message}</div> : null}
      <button type="button" className="android-install-later" onClick={close}>{permission === "denied" ? "Cerrar" : "Ahora no"}</button>
    </motion.section>
  </motion.div> : null}</AnimatePresence>;
}
