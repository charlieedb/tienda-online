"use client";

import { getAuthClient } from "@/lib/firebase";

export type AdminProfile = {
  uid: string;
  active: boolean;
  email?: string | null;
  name?: string | null;
};

export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  const auth = getAuthClient();
  const user = auth?.currentUser;
  if (!user || user.uid !== uid) return null;

  const token = await user.getIdToken();
  const response = await fetch(
    "https://us-central1-app-presu.cloudfunctions.net/authorizeStoreAdmin",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    profile?: AdminProfile;
  } | null;
  if (!response.ok || result?.ok !== true || !result.profile?.active) return null;
  return result.profile;
}
