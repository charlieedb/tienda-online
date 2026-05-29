import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { hasFirebaseEnv } from "@/lib/env";

function getFirebaseConfig() {
  if (!hasFirebaseEnv()) return null;

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

export function getFirebaseApp() {
  const config = getFirebaseConfig();
  if (!config) return null;
  return getApps().length ? getApps()[0]! : initializeApp(config);
}

export function getDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}

export function getAuthClient(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}
