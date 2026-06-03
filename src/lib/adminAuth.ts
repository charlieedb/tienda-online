"use client";

import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type AdminProfile = {
  uid: string;
  active: boolean;
  email?: string | null;
  name?: string | null;
};

export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  const db = getDb();
  if (!db) return null;

  const snap = await getDoc(doc(db, "adminUsers", uid));
  if (!snap.exists()) return null;

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
