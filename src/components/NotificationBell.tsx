import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { getActiveNotifications, getUserNotifications, sanitizeNotificationHtml, type NotificationCampaign } from "@/lib/notifications";
import { enablePushNotifications } from "@/lib/pushNotifications";
import { useAuth } from "@/auth/AuthProvider";
import { getDiscountCodes } from "@/lib/discountCodes";

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

export function NotificationBell({ onSearch, onOpenCatalog, onOpenCart, onOpenProduct }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCampaign[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  useEffect(() => {
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "JOMA_NOTIFICATION_RECEIVED") return;
      setUnreadCount((current) => Math.max(1, current + 1));
    };
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
  }, []);

  useEffect(() => {
    void Promise.all([getStoredPushNotifications(), user ? getUserNotifications(user.uid).catch(() => []) : Promise.resolve([]), getDiscountCodes().catch(() => [])]).then(([storedItems, personalItems, codes]) => {
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

  const toggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;
    setLoading(true);
    try {
      const [remoteItems, personalItems, storedItems, codes] = await Promise.all([getActiveNotifications().catch(() => []), user ? getUserNotifications(user.uid).catch(() => []) : Promise.resolve([]), getStoredPushNotifications(), getDiscountCodes().catch(() => [])]);
      const isLocalPreview = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const localItems = isLocalPreview ? [LOCAL_PREVIEW_NOTIFICATION] : [];
      const activeCodes = new Set(codes.filter((code) => code.active).map((code) => code.code));
      const items = onlyNotificationsWithActiveCoupons([...localItems, ...personalItems, ...storedItems, ...remoteItems.filter((item) => !storedItems.some((stored) => stored.id === item.id))], activeCodes)
        .filter((item) => !item.expiresAt || item.expiresAt >= new Date().toISOString())
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      const readIds = getReadNotificationIds();
      setNotifications(items);
      setUnreadCount(items.filter((item) => !readIds.has(item.id)).length);
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

  return <div className="notifications" ref={containerRef}>
    <button type="button" className={`notifications__trigger ${unreadCount ? "has-unread" : ""}`} aria-label={unreadCount ? `Abrir notificaciones, ${unreadCount} sin leer` : "Abrir notificaciones"} aria-expanded={open} aria-controls={panelId} onClick={() => void toggle()}><Icon name="bell" />{unreadCount ? <b>{unreadCount > 9 ? "9+" : unreadCount}</b> : null}</button>
    <AnimatePresence>{open ? <motion.div id={panelId} className="notifications__panel" role="region" aria-label="Notificaciones" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .01 : .18, ease: "easeOut" }}>
      <div className="notifications__head"><strong>Notificaciones</strong><span>{notifications.length ? `${notifications.length} activas` : "Historial activo"}</span></div>
      {loading ? <div className="notifications__empty"><span>Cargando notificaciones...</span></div> : notifications.length ? <div className="notifications__list">{notifications.map((notification) => { const isRead = getReadNotificationIds().has(notification.id); return <button type="button" className={isRead ? "is-read" : "is-unread"} key={notification.id} onClick={() => activate(notification)}><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>{notification.title}</strong><span dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(notification.body) }} /><small>{isRead ? "Leída" : notification.action !== "none" ? "Nueva · Tocá para continuar" : "Nueva"}</small></div></button>; })}</div> : <div className="notifications__empty"><div className="notifications__empty-icon"><Icon name="bell" /></div><div><strong>Sin notificaciones</strong><span>Cuando tengas novedades, aparecerán acá.</span></div></div>}
      {user && !pushEnabled ? <div className="notifications__push"><button type="button" disabled={enablingPush} onClick={async () => { setEnablingPush(true); setPushMessage(""); try { await enablePushNotifications(user); window.localStorage.setItem("joma.pushEnabled", "1"); setPushEnabled(true); } catch (error) { setPushMessage(error instanceof Error ? error.message : "No se pudieron activar los avisos."); } finally { setEnablingPush(false); } }}>{enablingPush ? "Activando..." : "Activar avisos en este dispositivo"}</button>{pushMessage ? <small role="status">{pushMessage}</small> : null}</div> : null}
    </motion.div> : null}</AnimatePresence>
  </div>;
}
