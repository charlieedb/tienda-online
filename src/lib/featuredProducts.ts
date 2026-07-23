import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

const STORE_CONFIG_PATH = "config/tiendaOnlineStore";

export type FeaturedProductsConfig = {
  ids: string[];
  configured: boolean;
};

let cachedConfig: FeaturedProductsConfig | null = null;
let pendingConfig: Promise<FeaturedProductsConfig> | null = null;

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

export async function getFeaturedProductsConfig(options?: { refresh?: boolean }) {
  if (!options?.refresh && cachedConfig) return cachedConfig;
  if (!options?.refresh && pendingConfig) return pendingConfig;
  const db = getDb();
  if (!db) return { ids: [], configured: false };

  pendingConfig = getDoc(doc(db, STORE_CONFIG_PATH))
    .then((snapshot) => {
      const result = {
        ids: normalizeIds(snapshot.data()?.featuredProductIds),
        configured: snapshot.exists(),
      };
      cachedConfig = result;
      return result;
    })
    .catch(() => ({ ids: [], configured: false }))
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
  cachedConfig = { ids: normalized, configured: true };
  return cachedConfig;
}
