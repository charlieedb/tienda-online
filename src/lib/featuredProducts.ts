import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

const STORE_CONFIG_PATH = "config/tiendaOnlineStore";
const STORE_CONFIG_CACHE_KEY = "joma.storeConfig.v1";

export type FeaturedProductsConfig = {
  ids: string[];
  configured: boolean;
  carouselSlides: StoreCarouselSlide[];
  deliverySchedule: DeliveryScheduleConfig;
};

export type DeliveryScheduleConfig = {
  weekdays: number[];
  timeRanges: Array<{
    startTime: string;
    endTime: string;
  }>;
};

export const DEFAULT_DELIVERY_SCHEDULE: DeliveryScheduleConfig = {
  weekdays: [1, 2, 3, 4, 5, 6],
  timeRanges: [
    { startTime: "08:00", endTime: "13:00" },
    { startTime: "15:00", endTime: "18:00" },
  ],
};

export type CarouselTargetType = "none" | "categories" | "category" | "search" | "cart";
export type CarouselTextPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";
export type CarouselTitleSize = "small" | "medium" | "large";
export type CarouselButtonAlign = "left" | "center" | "right";

export type StoreCarouselSlide = {
  id: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  targetType: CarouselTargetType;
  targetValue: string;
  textPosition: CarouselTextPosition;
  titleSize: CarouselTitleSize;
  buttonAlign: CarouselButtonAlign;
};

let cachedConfig: FeaturedProductsConfig | null = null;
let pendingConfig: Promise<FeaturedProductsConfig> | null = null;

function configFromSnapshot(snapshot: { exists(): boolean; data(): Record<string, unknown> | undefined }) {
  return {
    ids: normalizeIds(snapshot.data()?.featuredProductIds),
    configured: snapshot.exists(),
    carouselSlides: normalizeCarouselSlides(snapshot.data()?.carouselSlides),
    deliverySchedule: normalizeDeliverySchedule(snapshot.data()?.deliverySchedule),
  };
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function normalizeDeliveryTime(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function normalizeDeliverySchedule(value: unknown): DeliveryScheduleConfig {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const weekdays = Array.isArray(item.weekdays)
    ? [...new Set(item.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 6))]
    : DEFAULT_DELIVERY_SCHEDULE.weekdays;
  const timeRanges = Array.isArray(item.timeRanges)
    ? item.timeRanges.flatMap((range) => {
        const record = range && typeof range === "object" ? range as Record<string, unknown> : {};
        const startTime = normalizeDeliveryTime(record.startTime, "");
        const endTime = normalizeDeliveryTime(record.endTime, "");
        return startTime && endTime && startTime < endTime ? [{ startTime, endTime }] : [];
      }).slice(0, 6)
    : [];
  return {
    weekdays: weekdays.length ? weekdays.sort((a, b) => a - b) : DEFAULT_DELIVERY_SCHEDULE.weekdays,
    timeRanges: timeRanges.length ? timeRanges : DEFAULT_DELIVERY_SCHEDULE.timeRanges,
  };
}

function normalizeCarouselSlides(value: unknown): StoreCarouselSlide[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((entry, index) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const targetType = String(item.targetType ?? "none") as CarouselTargetType;
    const textPosition = String(item.textPosition ?? "top-left") as CarouselTextPosition;
    const titleSize = String(item.titleSize ?? "large") as CarouselTitleSize;
    const buttonAlign = String(item.buttonAlign ?? "left") as CarouselButtonAlign;
    return {
      id: String(item.id ?? `slide-${index + 1}`).trim() || `slide-${index + 1}`,
      mobileImageUrl: String(item.mobileImageUrl ?? item.imageUrl ?? "").trim(),
      desktopImageUrl: String(item.desktopImageUrl ?? item.imageUrl ?? "").trim(),
      imageAlt: String(item.imageAlt ?? "").trim(),
      eyebrow: String(item.eyebrow ?? "").trim(),
      title: String(item.title ?? "").trim(),
      subtitle: String(item.subtitle ?? "").trim(),
      buttonLabel: String(item.buttonLabel ?? "").trim(),
      targetType: ["none", "categories", "category", "search", "cart"].includes(targetType) ? targetType : "none",
      targetValue: String(item.targetValue ?? "").trim(),
      textPosition: [
        "top-left", "top-center", "top-right",
        "center-left", "center", "center-right",
        "bottom-left", "bottom-center", "bottom-right",
      ].includes(textPosition) ? textPosition : "top-left",
      titleSize: ["small", "medium", "large"].includes(titleSize) ? titleSize : "large",
      buttonAlign: ["left", "center", "right"].includes(buttonAlign) ? buttonAlign : "left",
    };
  });
}

function normalizeStoredConfig(value: unknown): FeaturedProductsConfig | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.configured !== true) return null;
  return {
    ids: normalizeIds(item.ids),
    configured: true,
    carouselSlides: normalizeCarouselSlides(item.carouselSlides),
    deliverySchedule: normalizeDeliverySchedule(item.deliverySchedule),
  };
}

function readStoredConfig() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeStoredConfig(JSON.parse(window.localStorage.getItem(STORE_CONFIG_CACHE_KEY) || "null"));
  } catch {
    return null;
  }
}

function storeValidConfig(config: FeaturedProductsConfig) {
  cachedConfig = config;
  if (!config.configured || typeof window === "undefined") return config;
  try {
    window.localStorage.setItem(STORE_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // La configuraciÃ³n en memoria sigue disponible si el navegador bloquea localStorage.
  }
  return config;
}

function emptyConfig(): FeaturedProductsConfig {
  return { ids: [], configured: false, carouselSlides: [], deliverySchedule: DEFAULT_DELIVERY_SCHEDULE };
}

export async function getFeaturedProductsConfig(options?: { refresh?: boolean }) {
  if (!options?.refresh && cachedConfig) return cachedConfig;
  if (!options?.refresh && pendingConfig) return pendingConfig;
  const db = getDb();
  if (!db) return cachedConfig ?? readStoredConfig() ?? emptyConfig();

  pendingConfig = getDoc(doc(db, STORE_CONFIG_PATH))
    .then((snapshot) => {
      const result = configFromSnapshot(snapshot);
      return storeValidConfig(result);
    })
    .catch(() => cachedConfig ?? readStoredConfig() ?? emptyConfig())
    .finally(() => {
      pendingConfig = null;
    });

  return pendingConfig;
}

export function subscribeToStoreConfig(onChange: () => void) {
  const db = getDb();
  if (!db) return () => {};
  let receivedInitialSnapshot = false;
  return onSnapshot(doc(db, STORE_CONFIG_PATH), (snapshot) => {
    storeValidConfig(configFromSnapshot(snapshot));
    if (receivedInitialSnapshot) onChange();
    receivedInitialSnapshot = true;
  }, () => {
    // Keep the last valid configuration when the realtime connection is unavailable.
  });
}

export async function saveFeaturedProductIds(ids: string[], actor: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const normalized = normalizeIds(ids);
  await setDoc(doc(db, STORE_CONFIG_PATH), {
    featuredProductIds: normalized,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  }, { merge: true });
  cachedConfig = {
    ids: normalized,
    configured: true,
    carouselSlides: cachedConfig?.carouselSlides ?? [],
    deliverySchedule: cachedConfig?.deliverySchedule ?? DEFAULT_DELIVERY_SCHEDULE,
  };
  storeValidConfig(cachedConfig);
  return cachedConfig;
}

export async function getStoreCarouselSlides(options?: { refresh?: boolean }) {
  return (await getFeaturedProductsConfig(options)).carouselSlides;
}

export async function getDeliveryScheduleConfig(options?: { refresh?: boolean }) {
  return (await getFeaturedProductsConfig(options)).deliverySchedule;
}

export async function saveDeliveryScheduleConfig(schedule: DeliveryScheduleConfig, actor: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const normalized = normalizeDeliverySchedule(schedule);
  await setDoc(doc(db, STORE_CONFIG_PATH), {
    deliverySchedule: normalized,
    deliveryScheduleUpdatedAt: serverTimestamp(),
    deliveryScheduleUpdatedBy: actor,
  }, { merge: true });
  cachedConfig = {
    ids: cachedConfig?.ids ?? [],
    configured: true,
    carouselSlides: cachedConfig?.carouselSlides ?? [],
    deliverySchedule: normalized,
  };
  storeValidConfig(cachedConfig);
  return normalized;
}

export async function saveStoreCarouselSlides(slides: StoreCarouselSlide[], actor: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");
  const normalized = normalizeCarouselSlides(slides);
  await setDoc(doc(db, STORE_CONFIG_PATH), {
    carouselSlides: normalized,
    carouselUpdatedAt: serverTimestamp(),
    carouselUpdatedBy: actor,
  }, { merge: true });
  cachedConfig = {
    ids: cachedConfig?.ids ?? [],
    configured: true,
    carouselSlides: normalized,
    deliverySchedule: cachedConfig?.deliverySchedule ?? DEFAULT_DELIVERY_SCHEDULE,
  };
  storeValidConfig(cachedConfig);
  return normalized;
}
