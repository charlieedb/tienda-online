import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type NotificationAction = "none" | "coupon" | "catalog" | "product" | "cart" | "search";
export type NotificationAudience = "all" | "business" | "consumer";
export type NotificationStatus = "draft" | "scheduled" | "sent" | "paused" | "finished";

export type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  bodyText?: string;
  audience: NotificationAudience;
  action: NotificationAction;
  target: string;
  status: NotificationStatus;
  scheduledAt: string;
  expiresAt: string;
  createdAtIso: string;
};

export async function createNotificationCampaign(input: Omit<NotificationCampaign, "id" | "createdAtIso">, actor: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const createdAtIso = new Date().toISOString();
  const reference = await addDoc(collection(db, "notificationCampaigns"), {
    ...input,
    createdAtIso,
    createdAt: serverTimestamp(),
    createdBy: actor,
    deliveredCount: 0,
    openedCount: 0,
    redeemedCount: 0,
  });
  return { ...input, id: reference.id, createdAtIso };
}

export function sanitizeNotificationHtml(value: string) {
  if (typeof document === "undefined") return String(value ?? "").replace(/<[^>]*>/g, " ").trim();
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "BR", "SPAN"]);
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        if (!allowed.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
        const color = element.style.color;
        for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
        if (element.tagName === "SPAN" && /^(#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(color)) element.style.color = color;
      }
      clean(child);
    }
  };
  clean(template.content);
  return template.innerHTML.slice(0, 1200);
}

export function notificationPlainText(value: string) {
  if (typeof document === "undefined") return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const template = document.createElement("template");
  template.innerHTML = sanitizeNotificationHtml(value);
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

export async function getActiveNotifications(maxResults = 100) {
  const db = getDb();
  if (!db) return [];
  const snapshot = await getDocs(query(
    collection(db, "notificationCampaigns"),
    where("status", "==", "sent"),
    limit(Math.max(1, Math.min(100, maxResults))),
  ));
  const now = new Date().toISOString();
  return snapshot.docs.flatMap((entry) => {
    const item = entry.data() as Record<string, unknown>;
    const expiresAt = String(item.expiresAt ?? "");
    if (expiresAt && expiresAt < now) return [];
    return [{
      id: entry.id,
      title: String(item.title ?? ""),
      body: String(item.body ?? ""),
      bodyText: String(item.bodyText ?? ""),
      audience: (item.audience === "business" || item.audience === "consumer" ? item.audience : "all") as NotificationAudience,
      action: (["coupon", "catalog", "product", "cart", "search"].includes(String(item.action)) ? item.action : "none") as NotificationAction,
      target: String(item.target ?? ""),
      status: "sent" as const,
      scheduledAt: String(item.scheduledAt ?? ""),
      expiresAt,
      createdAtIso: String(item.createdAtIso ?? ""),
    }];
  }).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}
