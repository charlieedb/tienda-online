import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type DailyOfferUsage = Record<string, number>;

let memoryCache: { key: string; value: DailyOfferUsage } | null = null;
let inFlight: Promise<DailyOfferUsage> | null = null;

function buenosAiresDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function startOfBuenosAiresDay(dayKey: string) {
  return new Date(`${dayKey}T00:00:00-03:00`);
}

export async function getDailyOfferUsage(uid: string, force = false): Promise<DailyOfferUsage> {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return {};
  const dayKey = buenosAiresDayKey();
  const cacheKey = `${cleanUid}:${dayKey}`;
  if (!force && memoryCache?.key === cacheKey) return memoryCache.value;
  if (!force && inFlight) return inFlight;

  const db = getDb();
  if (!db) return {};
  inFlight = (async () => {
    const snapshot = await getDocs(query(
      collection(db, "orders"),
      where("cliente.uid", "==", cleanUid),
      where("audit.createdAt", ">=", Timestamp.fromDate(startOfBuenosAiresDay(dayKey))),
      orderBy("audit.createdAt", "desc"),
      limit(50),
    ));
    const usage: DailyOfferUsage = {};
    snapshot.docs.forEach((entry) => {
      const data = entry.data();
      if (["rejected", "stock_rejected"].includes(String(data?.status || ""))) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      items.forEach((item: Record<string, unknown>) => {
        const code = String(item.codigo ?? "").trim();
        const promo = item.promoCaja && typeof item.promoCaja === "object"
          ? item.promoCaja as Record<string, unknown>
          : null;
        const units = Math.max(0, Math.trunc(Number(promo?.unidadesConPromo) || 0));
        if (code && units) usage[code] = (usage[code] || 0) + units;
      });
    });
    memoryCache = { key: cacheKey, value: usage };
    return usage;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function clearDailyOfferUsageCache() {
  memoryCache = null;
}
