import { getDb } from "@/lib/firebase";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export type UserProfile = {
  uid: string;
  email: string | null;
  username: string;
  dni: string;
  displayName?: string | null;
};

export function normalizeUsername(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "");
}

export async function reserveUsername(params: {
  uid: string;
  email: string | null;
  username: string;
}) {
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

export async function upsertUserProfile(profile: UserProfile) {
  const db = getDb();
  if (!db) throw new Error("Firebase no está configurado.");

  const ref = doc(db, "users", profile.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      email: profile.email ?? null,
      username: normalizeUsername(profile.username),
      dni: String(profile.dni ?? "").trim(),
      displayName: profile.displayName ?? null,
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
