import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { getActiveNotifications, getUserNotifications, sanitizeNotificationHtml, type NotificationCampaign } from "@/lib/notifications";
import { enablePushNotifications, isInstalledPwa, syncPushNotificationRegistration } from "@/lib/pushNotifications";
import { useAuth } from "@/auth/AuthProvider";
import { getDiscountCodes, getMyDiscountCodes } from "@/lib/discountCodes";

type Props = {
  onSearch?: (query: string) => void;
  onOpenCatalog?: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (productId: string) => void;
};

const LOCAL_PREVIEW_NOTIFICATION: NotificationCampaign = {
  id: "local-preview-unread-v2",
  title: "¡Nueva promo disponible!",
  body: "Esta es una notificación simulada para revisar la campanita.",
  audience: "all",
  action: "none",
  target: "",
  status: "sent",
  scheduledAt: "",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  createdAtIso: new Date().toISOString(),
};

function getReadNotificationIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem("joma.readNotifications") || "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function markNotificationsAsRead(items: NotificationCampaign[]) {
  const readIds = getReadNotificationIds();
  items.forEach((item) => readIds.add(item.id));
  window.localStorage.setItem("joma.readNotifications", JSON.stringify([...readIds]));
}

async function getStoredPushNotifications(): Promise<NotificationCampaign[]> {
  if (!("caches" in window)) return [];
  try {
    const response = await caches.match("/__joma_notifications__");
    const items = response ? await response.json() : [];
    const now = new Date().toISOString();
    if (!Array.isArray(items)) return [];
    return items.filter((item) => !item.expiresAt || item.expiresAt >= now).map((item) => ({
      id: String(item.id || ""), title: String(item.title || "JOMA Express"), body: String(item.body || ""),
      audience: item.audience === "business" || item.audience === "consumer" ? item.audience : "all",
      action: ["coupon", "catalog", "product", "cart", "search"].includes(item.action) ? item.action : "none",
      target: String(item.target || ""), status: "sent", scheduledAt: "",
      expiresAt: String(item.expiresAt || ""), createdAtIso: String(item.createdAtIso || ""),
    }));
  } catch { return []; }
}

function onlyNotificationsWithActiveCoupons(items: NotificationCampaign[], activeCodes: Set<string>) {
  return items.filter((item) => item.action !== "coupon" || activeCodes.has(item.target.trim().toLocaleUpperCase("es-AR")));
}

async function getVisibleDiscountCodes(uid?: string) {
  const [publicCodes, personalCodes] = await Promise.all([
    getDiscountCodes().catch(() => []),
    uid ? getMyDiscountCodes(uid).catch(() => []) : Promise.resolve([]),
  ]);
  return [...new Map([...publicCodes, ...personalCodes].map((code) => [code.code, code])).values()];
}

export function NotificationBell({ onSearch, onOpenCatalog, onOpenCart, onOpenProduct }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCampaign[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushMessage, setPushMessage] = useState("");
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => "Notification" in window && Notification.permission === "granted");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const reduceMotion = useReducedMotion();
  const installedApp = isInstalledPwa();

  useEffect(() => {
    if (!user || !installedApp || !("Notification" in window) || Notification.permission !== "granted") return;
    void syncPushNotificationRegistration(user).then((synced) => setPushEnabled(synced)).catch(() => setPushEnabled(false));
  }, [user, installedApp]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "JOMA_NOTIFICATION_RECEIVED") {
        setUnreadCount((current) => Math.max(1, current + 1));
        return;
      }
      if (event.data?.type === "JOMA_NOTIFICATION_REMOVED" && typeof event.data.campaignId === "string") {
        setNotifications((current) => current.filter((item) => item.id !== event.data.campaignId));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    };
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
  }, []);

  useEffect(() => {
    void Promise.all([getStoredPushNotifications(), user ? getUserNotifications(user.uid).catch(() => []) : Promise.resolve([]), getVisibleDiscountCodes(user?.uid)]).then(([storedItems, personalItems, codes]) => {
      const readIds = getReadNotificationIds();
      const isLocalPreview = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalPreview && !window.sessionStorage.getItem("joma.localPreviewSeededV2")) {
        readIds.delete(LOCAL_PREVIEW_NOTIFICATION.id);
        window.localStorage.setItem("joma.readNotifications", JSON.stringify([...readIds]));
        window.sessionStorage.setItem("joma.localPreviewSeededV2", "1");
      }
      const activeCodes = new Set(codes.filter((code) => code.active).map((code) => code.code));
      const items = onlyNotificationsWithActiveCoupons([...personalItems, ...storedItems], activeCodes);
      const visibleItems = isLocalPreview && !items.some((item) => item.id === LOCAL_PREVIEW_NOTIFICATION.id) ? [LOCAL_PREVIEW_NOTIFICATION, ...items] : items;
      if (visibleItems.length) setNotifications(visibleItems);
      setUnreadCount(visibleItems.filter((item) => !readIds.has(item.id)).length);
    });
  }, [user]);

  const markAsRead = (notificationId: string) => {
    const readIds = getReadNotificationIds();
    readIds.add(notificationId);
    window.localStorage.setItem("joma.readNotifications", JSON.stringify([...readIds]));
    setUnreadCount(notifications.filter((item) => item.id !== notificationId && !readIds.has(item.id)).length);
  };

  const closePanel = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const toggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;
    markNotificationsAsRead(notifications);
    setUnreadCount(0);
    setLoading(true);
    try {
      let remoteLoaded = true;
      if (user) await getMyDiscountCodes(user.uid, true).catch(() => []);
      const [remoteItems, personalItems, storedItems, codes] = await Promise.all([getActiveNotifications().catch(() => { remoteLoaded = false; return []; }), user ? getUserNotifications(user.uid).catch(() => []) : Promise.resolve([]), getStoredPushNotifications(), getVisibleDiscountCodes(user?.uid)]);
      const isLocalPreview = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const localItems = isLocalPreview ? [LOCAL_PREVIEW_NOTIFICATION] : [];
      const activeCodes = new Set(codes.filter((code) => code.active).map((code) => code.code));
      const remoteIds = new Set(remoteItems.map((item) => item.id));
      const visibleStoredItems = remoteLoaded ? storedItems.filter((item) => remoteIds.has(item.id)) : storedItems;
      const items = onlyNotificationsWithActiveCoupons([...localItems, ...personalItems, ...visibleStoredItems, ...remoteItems.filter((item) => !visibleStoredItems.some((stored) => stored.id === item.id))], activeCodes)
        .filter((item) => !item.expiresAt || item.expiresAt >= new Date().toISOString())
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      setNotifications(items);
      markNotificationsAsRead(items);
      setUnreadCount(0);
    }
    finally { setLoading(false); }
  };

  const activate = (notification: NotificationCampaign) => {
    markAsRead(notification.id);
    setOpen(false);
    if (notification.action === "coupon") {
      window.localStorage.setItem("joma.pendingCoupon", notification.target);
      window.dispatchEvent(new CustomEvent("joma:coupon-selected", { detail: notification.target }));
      onOpenCart?.();
    } else if (notification.action === "search") onSearch?.(notification.target);
    else if (notification.action === "catalog") onOpenCatalog?.();
    else if (notification.action === "cart") onOpenCart?.();
    else if (notification.action === "product") onOpenProduct?.(notification.target);
  };

  return <div className="notifications">
    <button ref={triggerRef} type="button" className={`notifications__trigger ${unreadCount ? "has-unread" : ""}`} aria-label={unreadCount ? `Abrir notificaciones, ${unreadCount} sin leer` : "Abrir notificaciones"} aria-expanded={open} aria-controls={panelId} onClick={() => void toggle()}><Icon name="bell" />{unreadCount ? <b>{unreadCount > 9 ? "9+" : unreadCount}</b> : null}</button>
    {typeof document !== "undefined" ? createPortal(<AnimatePresence>{open ? <>
      <motion.button type="button" className="notifications__scrim" aria-label="Cerrar notificaciones" onClick={closePanel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18 }} />
      <motion.aside id={panelId} className="notifications__panel" role="dialog" aria-modal="true" aria-label="Notificaciones" initial={reduceMotion ? { opacity: 0 } : { x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { x: "100%" }} transition={{ duration: reduceMotion ? .01 : .22, ease: [0.22, 1, 0.36, 1] }}>
      <div className="notifications__head"><div><strong>Notificaciones</strong><span>{notifications.length ? `${notifications.length} activas` : "Historial activo"}</span></div><button type="button" autoFocus onClick={closePanel} aria-label="Cerrar notificaciones"><Icon name="close" /></button></div>
      {loading ? <div className="notifications__empty"><span>Cargando notificaciones...</span></div> : notifications.length ? <div className="notifications__list">{notifications.map((notification) => { const isRead = getReadNotificationIds().has(notification.id); return <button type="button" className={isRead ? "is-read" : "is-unread"} key={notification.id} onClick={() => activate(notification)}><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>{notification.title}</strong><span dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(notification.body) }} /><small>{isRead ? "Leída" : notification.action !== "none" ? "Nueva · Tocá para continuar" : "Nueva"}</small></div></button>; })}</div> : <div className="notifications__empty"><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>Sin notificaciones</strong><span>Cuando tengas novedades, aparecerán acá.</span></div></div>}
      {user && installedApp && !pushEnabled ? <div className="notifications__push"><button type="button" disabled={enablingPush} onClick={async () => { setEnablingPush(true); setPushMessage(""); try { await enablePushNotifications(user); setPushEnabled(true); } catch (error) { setPushMessage(error instanceof Error ? error.message : "No se pudieron activar los avisos."); } finally { setEnablingPush(false); } }}>{enablingPush ? "Activando..." : "Activar avisos en este dispositivo"}</button>{pushMessage ? <small role="status">{pushMessage}</small> : null}</div> : null}
      </motion.aside>
    </> : null}</AnimatePresence>, document.body) : null}
  </div>;
}
