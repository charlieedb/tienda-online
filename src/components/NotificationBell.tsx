import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { getActiveNotifications, sanitizeNotificationHtml, type NotificationCampaign } from "@/lib/notifications";
import { enablePushNotifications } from "@/lib/pushNotifications";
import { useAuth } from "@/auth/AuthProvider";

type Props = {
  onSearch?: (query: string) => void;
  onOpenCatalog?: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (productId: string) => void;
};

export function NotificationBell({ onSearch, onOpenCatalog, onOpenCart, onOpenProduct }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => window.localStorage.getItem("joma.pushEnabled") === "1");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePress); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const toggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || loaded) return;
    setLoading(true);
    try { setNotifications(await getActiveNotifications()); }
    finally { setLoading(false); setLoaded(true); }
  };

  const activate = (notification: NotificationCampaign) => {
    setOpen(false);
    if (notification.action === "coupon") {
      window.localStorage.setItem("joma.pendingCoupon", notification.target);
      onOpenCart?.();
    } else if (notification.action === "search") onSearch?.(notification.target);
    else if (notification.action === "catalog") onOpenCatalog?.();
    else if (notification.action === "cart") onOpenCart?.();
    else if (notification.action === "product") onOpenProduct?.(notification.target);
  };

  return <div className="notifications" ref={containerRef}>
    <button type="button" className={`notifications__trigger ${open ? "is-active" : ""}`} aria-label="Abrir notificaciones" aria-expanded={open} aria-controls={panelId} onClick={() => void toggle()}><Icon name="bell" />{notifications.length ? <b>{notifications.length > 9 ? "9+" : notifications.length}</b> : null}</button>
    <AnimatePresence>{open ? <motion.div id={panelId} className="notifications__panel" role="region" aria-label="Notificaciones" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18, ease: "easeOut" }}>
      {loading ? <div className="notifications__empty"><span>Cargando notificaciones...</span></div> : notifications.length ? <div className="notifications__list">{notifications.map((notification) => <button type="button" key={notification.id} onClick={() => activate(notification)}><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>{notification.title}</strong><span dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(notification.body) }} />{notification.action !== "none" ? <small>Tocá para continuar</small> : null}</div></button>)}</div> : <div className="notifications__empty"><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>Sin notificaciones</strong><span>Cuando tengas novedades, aparecerán acá.</span></div></div>}
      {user && !pushEnabled ? <div className="notifications__push"><button type="button" disabled={enablingPush} onClick={async () => { setEnablingPush(true); setPushMessage(""); try { await enablePushNotifications(user); window.localStorage.setItem("joma.pushEnabled", "1"); setPushEnabled(true); } catch (error) { setPushMessage(error instanceof Error ? error.message : "No se pudieron activar los avisos."); } finally { setEnablingPush(false); } }}>{enablingPush ? "Activando..." : "Activar avisos en este dispositivo"}</button>{pushMessage ? <small role="status">{pushMessage}</small> : null}</div> : null}
    </motion.div> : null}</AnimatePresence>
  </div>;
}
