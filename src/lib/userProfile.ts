import { getDb } from "@/lib/firebase";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

export type LatLng = { lat: number; lng: number };

export type UserAddress = {
  id: string;
  provincia: string;
  localidad: string;
  direccion: string;
  ubicacion: LatLng | null;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  username: string;
  dni: string;
  displayName?: string | null;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  preventistaReferido?: string;
  notes?: string;
  direcciones?: UserAddress[];
};

const profileCacheKey = (uid: string) => `listita.userProfile.${uid}`;
const PROFILE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
type CachedProfileEnvelope = {
  profile: UserProfile;
  cachedAt: number;
};
const memoryProfileCache = new Map<string, CachedProfileEnvelope>();
const inflightProfileRequests = new Map<string, Promise<UserProfile | null>>();
type RawLatLng = { lat?: unknown; lng?: unknown };
type RawAddress = {
  id?: unknown;
  provincia?: unknown;
  localidad?: unknown;
  direccion?: unknown;
  ubicacion?: unknown;
};
type RawProfile = {
  email?: unknown;
  username?: unknown;
  dni?: unknown;
  displayName?: unknown;
  nombre?: unknown;
  apellido?: unknown;
  telefono?: unknown;
  preventistaReferido?: unknown;
  notes?: unknown;
  direcciones?: unknown;
  provincia?: unknown;
  localidad?: unknown;
  direccion?: unknown;
  ubicacion?: unknown;
};

export function normalizeUsername(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "");
}

export async function reserveUsername(params: { uid: string; email: string | null; username: string }) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");

  const username = normalizeUsername(params.username);
  if (!username) throw new Error("El usuario es obligatorio.");

  const ref = doc(db, "usernames", username);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error("Ese usuario ya está en uso.");
    tx.set(ref, {
      uid: params.uid,
      email: params.email ?? null,
      createdAt: serverTimestamp(),
    });
  });

  return username;
}

function normalizeAddress(raw: RawAddress | null | undefined, fallbackId: string): UserAddress {
  const id = typeof raw?.id === "string" && raw.id.trim() ? raw.id : fallbackId;
  const provincia = typeof raw?.provincia === "string" ? raw.provincia : "";
  const localidad = typeof raw?.localidad === "string" ? raw.localidad : "";
  const direccion = typeof raw?.direccion === "string" ? raw.direccion : "";
  const ubicacion =
    raw?.ubicacion && typeof raw.ubicacion === "object"
      ? {
          lat: Number((raw.ubicacion as RawLatLng).lat),
          lng: Number((raw.ubicacion as RawLatLng).lng),
        }
      : null;
  return {
    id,
    provincia: provincia.trim(),
    localidad: localidad.trim(),
    direccion: direccion.trim(),
    ubicacion:
      ubicacion && Number.isFinite(ubicacion.lat) && Number.isFinite(ubicacion.lng) ? ubicacion : null,
  };
}

function normalizeProfile(uid: string, raw: RawProfile | null | undefined): UserProfile {
  let direcciones: UserAddress[] | undefined;
  if (Array.isArray(raw?.direcciones)) {
    direcciones = raw.direcciones.map((a, idx: number) =>
      normalizeAddress((a as RawAddress | null | undefined) ?? undefined, `addr_${idx + 1}`),
    );
  } else {
    const legacy = normalizeAddress(
      {
        provincia: raw?.provincia ?? "",
        localidad: raw?.localidad ?? "",
        direccion: raw?.direccion ?? "",
        ubicacion: raw?.ubicacion ?? null,
      },
      "principal",
    );
    if (legacy.localidad || legacy.direccion || legacy.ubicacion) direcciones = [legacy];
  }

  return {
    uid,
    email: (raw?.email ?? null) as string | null,
    username: String(raw?.username ?? ""),
    dni: String(raw?.dni ?? ""),
    displayName: (raw?.displayName ?? null) as string | null,
    nombre: typeof raw?.nombre === "string" ? raw.nombre : "",
    apellido: typeof raw?.apellido === "string" ? raw.apellido : "",
    telefono: typeof raw?.telefono === "string" ? raw.telefono : "",
    preventistaReferido: typeof raw?.preventistaReferido === "string" ? raw.preventistaReferido : "",
    notes: typeof raw?.notes === "string" ? raw.notes : "",
    direcciones,
  } satisfies UserProfile;
}

function nowMs() {
  return Date.now();
}

function normalizeCachedEnvelope(uid: string, raw: unknown): CachedProfileEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { profile?: unknown; cachedAt?: unknown };
  if (data.profile && typeof data.profile === "object") {
    return {
      profile: normalizeProfile(uid, data.profile as RawProfile),
      cachedAt: Number(data.cachedAt || 0) || 0,
    };
  }
  return {
    profile: normalizeProfile(uid, raw as RawProfile),
    cachedAt: 0,
  };
}

function readCachedEnvelope(uid: string) {
  try {
    const fromMemory = memoryProfileCache.get(uid);
    if (fromMemory) return fromMemory;
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(profileCacheKey(uid));
    if (!raw) return null;
    const envelope = normalizeCachedEnvelope(uid, JSON.parse(raw));
    if (!envelope) return null;
    memoryProfileCache.set(uid, envelope);
    return envelope;
  } catch {
    return null;
  }
}

export function getCachedUserProfile(uid: string) {
  return readCachedEnvelope(uid)?.profile || null;
}

function writeCachedUserProfile(profile: UserProfile, cachedAt = nowMs()) {
  const envelope: CachedProfileEnvelope = { profile, cachedAt };
  memoryProfileCache.set(profile.uid, envelope);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(profileCacheKey(profile.uid), JSON.stringify(envelope));
  } catch {
    // Ignore storage failures; Firestore remains the main source when available.
  }
}

function isFresh(envelope: CachedProfileEnvelope | null, maxAgeMs: number) {
  if (!envelope) return false;
  if (!envelope.cachedAt) return false;
  return nowMs() - envelope.cachedAt <= Math.max(0, maxAgeMs);
}

async function fetchUserProfileRemote(uid: string) {
  const db = getDb();
  if (!db) return getCachedUserProfile(uid);

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return getCachedUserProfile(uid);
  const profile = normalizeProfile(uid, snap.data() as RawProfile);
  writeCachedUserProfile(profile);
  return profile;
}

export async function refreshUserProfile(
  uid: string,
  options?: {
    force?: boolean;
    maxAgeMs?: number;
  },
) {
  const maxAgeMs = options?.maxAgeMs ?? PROFILE_CACHE_MAX_AGE_MS;
  const cached = readCachedEnvelope(uid);
  if (!options?.force && isFresh(cached, maxAgeMs)) {
    return cached?.profile || null;
  }

  const inflight = inflightProfileRequests.get(uid);
  if (inflight) return inflight;

  const request = fetchUserProfileRemote(uid)
    .catch(() => getCachedUserProfile(uid))
    .finally(() => {
      inflightProfileRequests.delete(uid);
    });

  inflightProfileRequests.set(uid, request);
  return request;
}

export async function getUserProfile(
  uid: string,
  options?: {
    preferCache?: boolean;
    maxAgeMs?: number;
  },
) {
  const cached = getCachedUserProfile(uid);
  if (options?.preferCache !== false && cached) return cached;
  return refreshUserProfile(uid, { maxAgeMs: options?.maxAgeMs });
}

export async function preloadUserProfile(uid: string, maxAgeMs = PROFILE_CACHE_MAX_AGE_MS) {
  return refreshUserProfile(uid, { maxAgeMs });
}

export async function upsertUserProfile(profile: UserProfile) {
  const db = getDb();

  const direcciones = (profile.direcciones ?? [])
    .map((a, idx) => normalizeAddress(a, `addr_${idx + 1}`))
    .filter((a) => a.provincia || a.localidad || a.direccion || a.ubicacion);

  const normalizedProfile: UserProfile = {
    ...profile,
    username: normalizeUsername(profile.username),
    dni: String(profile.dni ?? "").trim(),
    nombre: String(profile.nombre ?? "").trim(),
    apellido: String(profile.apellido ?? "").trim(),
    telefono: String(profile.telefono ?? "").trim(),
    preventistaReferido: String(profile.preventistaReferido ?? "").trim(),
    notes: String(profile.notes ?? "").trim(),
    direcciones,
  };

  writeCachedUserProfile(normalizedProfile);

  if (!db) return;

  const ref = doc(db, "users", profile.uid);
  const first = direcciones[0] ?? null;

  await setDoc(
    ref,
    {
      email: normalizedProfile.email ?? null,
      username: normalizedProfile.username,
      dni: normalizedProfile.dni,
      displayName: normalizedProfile.displayName ?? null,
      nombre: normalizedProfile.nombre ?? "",
      apellido: normalizedProfile.apellido ?? "",
      telefono: normalizedProfile.telefono ?? "",
      preventistaReferido: normalizedProfile.preventistaReferido ?? "",
      notes: normalizedProfile.notes ?? "",
      direcciones: direcciones.length ? direcciones : [],
      provincia: first?.provincia ?? "",
      localidad: first?.localidad ?? "",
      direccion: first?.direccion ?? "",
      ubicacion: first?.ubicacion ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function resolveEmailFromUsername(usernameRaw: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");

  const username = normalizeUsername(usernameRaw);
  if (!username) return null;

  const ref = doc(db, "usernames", username);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { email?: string | null };
  return data.email ?? null;
}
