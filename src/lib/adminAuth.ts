"use client";

import { doc, getDoc } from "firebase/firestore";
import { getAuthClient } from "@/lib/firebase";
import { getDb } from "@/lib/firebase";

export type AdminProfile = {
  uid: string;
  active: boolean;
  email?: string | null;
  name?: string | null;
};

async function getLegacyAdminProfile(uid: string): Promise<AdminProfile | null> {
  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user || user.uid !== uid) return null;

  const token = await user.getIdToken(true);
  const response = await fetch(
    "https://us-central1-app-presu.cloudfunctions.net/getSessionContext",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    data?: { admin?: boolean; activo?: boolean; username?: string };
  } | null;
  if (!response.ok || result?.data?.admin !== true || result.data.activo === false) return null;
  return {
    uid,
    active: true,
    email: user.email,
    name: result.data.username || user.displayName,
  };
}

export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  const db = getDb();
  if (!db) return null;

  const snap = await getDoc(doc(db, "adminUsers", uid)).catch(() => null);
  if (!snap) return getLegacyAdminProfile(uid);
  if (!snap.exists()) {
    return getLegacyAdminProfile(uid);
  }

  const data = snap.data() as {
    active?: unknown;
    email?: unknown;
    name?: unknown;
  };

  return {
    uid,
    active: data?.active !== false,
    email: typeof data?.email === "string" ? data.email : null,
    name: typeof data?.name === "string" ? data.name : null,
  };
}
