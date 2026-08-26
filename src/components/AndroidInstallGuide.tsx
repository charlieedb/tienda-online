import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent);
}

export function canShowAndroidInstallGuide() {
  const preview = new URLSearchParams(window.location.search).get("previewInstallAndroid") === "1";
  return (preview || isAndroidDevice()) && !isStandalone();
}

export function AndroidInstallGuide() {
  const reduceMotion = useReducedMotion();
  const preview = new URLSearchParams(window.location.search).get("previewInstallAndroid") === "1";
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => !preview && window.localStorage.getItem("joma.androidInstallGuideDismissed") === "1");
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");
  const [previewStage, setPreviewStage] = useState<"install" | "notifications" | "system">("install");
  const supportedDevice = preview || isAndroidDevice();

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => { setInstalled(true); setOpen(false); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    const openFromMenu = () => {
      if (isStandalone()) return;
      setDismissed(false);
      setOpen(true);
    };
    window.addEventListener("joma:open-android-install-guide", openFromMenu);
    return () => window.removeEventListener("joma:open-android-install-guide", openFromMenu);
  }, []);

  if (!supportedDevice || installed || dismissed) return null;

  const close = () => {
    setOpen(false);
    setDismissed(true);
    if (!preview) window.localStorage.setItem("joma.androidInstallGuideDismissed", "1");
  };

  const install = async () => {
    if (preview) { setPreviewStage("notifications"); setMessage(""); return; }
    if (!promptEvent) { setMessage("Usá los tres puntos de Chrome y elegí “Instalar aplicación” o “Agregar a pantalla principal”."); return; }
    setInstalling(true);
    setMessage("");
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      else setMessage("La instalación fue cancelada. Podés intentarlo nuevamente desde el menú lateral.");
      setPromptEvent(null);
    } finally {
      setInstalling(false);
    }
  };

  return <>
    {!open ? <button type="button" className="pwa-guide-launcher android-install-launcher" onClick={() => setOpen(true)}><span className="pwa-guide-launcher__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg></span><span><strong>Instalar JOMA</strong><small>Tienda en tu inicio</small></span></button> : null}
    <AnimatePresence>{open ? <motion.div className="pwa-guide-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18 }}>
      <motion.section className="pwa-guide android-install-guide" role="dialog" aria-modal="true" aria-labelledby="android-install-title" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} transition={{ duration: reduceMotion ? .01 : .22, ease: [0.22, 1, 0.36, 1] }}>
        {previewStage === "install" ? <><div className="pwa-guide__head"><span className="android-install-guide__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg></span><div><span>Guía para Android</span><h2 id="android-install-title">Instalá JOMA Express</h2></div><button type="button" onClick={close} aria-label="Cerrar guía">×</button></div><p className="pwa-guide__intro">Instalá la tienda para encontrarla junto a tus aplicaciones y entrar con un solo toque.</p><div className="android-install-privacy"><strong>Sin permisos obligatorios</strong><p>Instalar la tienda no solicita acceso a tu teléfono. Las notificaciones son opcionales y podés activarlas después si querés recibir avisos.</p></div><button type="button" className="android-install-confirm" disabled={installing} onClick={() => void install()}>{installing ? "Abriendo instalación…" : "Instalar ahora"}</button>{message ? <div className="android-install-message" role="status">{message}</div> : null}<button type="button" className="android-install-later" onClick={close}>Ahora no</button></> : previewStage === "notifications" ? <><div className="pwa-guide__head"><span className="android-install-guide__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><div><span>Después de instalar</span><h2 id="android-install-title">¿Querés recibir avisos?</h2></div><button type="button" onClick={close} aria-label="Cerrar guía">×</button></div><p className="pwa-guide__intro">Podemos avisarte cuando recibas un cupón o haya una novedad importante. Es opcional y podés desactivarlo cuando quieras.</p><div className="android-install-privacy"><strong>Vos decidís</strong><p>JOMA solo pedirá permiso para mostrar notificaciones. No solicita acceso a fotos, contactos ni archivos.</p></div><button type="button" className="android-install-confirm" onClick={() => setPreviewStage("system")}>Activar notificaciones</button><button type="button" className="android-install-later" onClick={close}>Ahora no</button></> : <><div className="android-system-prompt-label">Simulación del aviso de Android</div><div className="android-system-prompt"><span className="android-system-prompt__bell" aria-hidden="true">●</span><strong>¿Permitir que JOMA Express te envíe notificaciones?</strong><p>Podrás recibir avisos de cupones y novedades.</p><div><button type="button" onClick={close}>No permitir</button><button type="button" onClick={close}>Permitir</button></div></div></>}
      </motion.section>
    </motion.div> : null}</AnimatePresence>
  </>;
}
