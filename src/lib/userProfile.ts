import { getDb } from "@/lib/firebase";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

export type LatLng = { lat: number; lng: number };

export type UserAddress = {
  id: string;
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
  direcciones?: UserAddress[];
};

const profileCacheKey = (uid: string) => `listita.userProfile.${uid}`;
type RawLatLng = { lat?: unknown; lng?: unknown };
type RawAddress = { id?: unknown; localidad?: unknown; direccion?: unknown; ubicacion?: unknown };
type RawProfile = {
  email?: unknown;
  username?: unknown;
  dni?: unknown;
  displayName?: unknown;
  nombre?: unknown;
  apellido?: unknown;
  telefono?: unknown;
  direcciones?: unknown;
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
      { localidad: raw?.localidad ?? "", direccion: raw?.direccion ?? "", ubicacion: raw?.ubicacion ?? null },
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
    direcciones,
  } satisfies UserProfile;
}

function readCachedUserProfile(uid: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(profileCacheKey(uid));
    if (!raw) return null;
    return normalizeProfile(uid, JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCachedUserProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(profileCacheKey(profile.uid), JSON.stringify(profile));
  } catch {
    // Ignore storage failures; Firestore remains the main source when available.
  }
}

export async function getUserProfile(uid: string) {
  const db = getDb();
  if (!db) return readCachedUserProfile(uid);

  const ref = doc(db, "users", uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return readCachedUserProfile(uid);
    const profile = normalizeProfile(uid, snap.data() as RawProfile);
    writeCachedUserProfile(profile);
    return profile;
  } catch {
    return readCachedUserProfile(uid);
  }
}

export async function upsertUserProfile(profile: UserProfile) {
  const db = getDb();

  const direcciones = (profile.direcciones ?? [])
    .map((a, idx) => normalizeAddress(a, `addr_${idx + 1}`))
    .filter((a) => a.localidad || a.direccion || a.ubicacion);

  const normalizedProfile: UserProfile = {
    ...profile,
    username: normalizeUsername(profile.username),
    dni: String(profile.dni ?? "").trim(),
    nombre: String(profile.nombre ?? "").trim(),
    apellido: String(profile.apellido ?? "").trim(),
    telefono: String(profile.telefono ?? "").trim(),
    direcciones,
  };

  writeCachedUserProfile(normalizedProfile);

  if (!db) return;

  const ref = doc(db, "users", profile.uid);
  const existing = await getDoc(ref);
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
      direcciones: direcciones.length ? direcciones : [],
      localidad: first?.localidad ?? "",
      direccion: first?.direccion ?? "",
      ubicacion: first?.ubicacion ?? null,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
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
