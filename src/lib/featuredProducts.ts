import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

const STORE_CONFIG_PATH = "config/tiendaOnlineStore";

export type FeaturedProductsConfig = {
  ids: string[];
  configured: boolean;
  carouselSlides: StoreCarouselSlide[];
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

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
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

export async function getFeaturedProductsConfig(options?: { refresh?: boolean }) {
  if (!options?.refresh && cachedConfig) return cachedConfig;
  if (!options?.refresh && pendingConfig) return pendingConfig;
  const db = getDb();
  if (!db) return { ids: [], configured: false, carouselSlides: [] };

  pendingConfig = getDoc(doc(db, STORE_CONFIG_PATH))
    .then((snapshot) => {
      const result = {
        ids: normalizeIds(snapshot.data()?.featuredProductIds),
        configured: snapshot.exists(),
        carouselSlides: normalizeCarouselSlides(snapshot.data()?.carouselSlides),
      };
      cachedConfig = result;
      return result;
    })
    .catch(() => ({ ids: [], configured: false, carouselSlides: [] }))
    .finally(() => {
      pendingConfig = null;
    });

  return pendingConfig;
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
  cachedConfig = { ids: normalized, configured: true, carouselSlides: cachedConfig?.carouselSlides ?? [] };
  return cachedConfig;
}

export async function getStoreCarouselSlides(options?: { refresh?: boolean }) {
  return (await getFeaturedProductsConfig(options)).carouselSlides;
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
  };
  return normalized;
}
