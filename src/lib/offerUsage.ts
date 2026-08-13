import { collection, getDocs, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type DailyOfferUsage = Record<string, number>;

const CACHE_TTL_MS = 60_000;
let memoryCache: { key: string; value: DailyOfferUsage; fetchedAt: number } | null = null;
let inFlight: Promise<DailyOfferUsage> | null = null;

function buenosAiresDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getDailyOfferUsage(uid: string, force = false): Promise<DailyOfferUsage> {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return {};
  const dayKey = buenosAiresDayKey();
  const cacheKey = `${cleanUid}:${dayKey}`;
  if (!force && memoryCache?.key === cacheKey && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) return memoryCache.value;
  if (!force && inFlight) return inFlight;

  const db = getDb();
  if (!db) return {};
  inFlight = (async () => {
    let snapshot;
    try {
      snapshot = await getDocs(query(
        collection(db, "dailyOfferUsage", dayKey, "users"),
        where("uid", "==", cleanUid),
      ));
    } catch (error) {
      console.warn("No se pudo precargar el cupo diario de ofertas; se validará al confirmar.", error);
      return {};
    }
    const usage: DailyOfferUsage = {};
    snapshot.docs.forEach((entry) => {
      const data = entry.data();
      const code = String(data?.code ?? "").trim().toUpperCase();
      const units = Math.max(0, Math.trunc(Number(data?.usedUnits) || 0));
      if (code && units) usage[code] = units;
    });
    memoryCache = { key: cacheKey, value: usage, fetchedAt: Date.now() };
    return usage;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function clearDailyOfferUsageCache() {
  memoryCache = null;
}
