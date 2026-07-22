import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { hasFirebaseEnv } from "@/lib/env";

function getFirebaseConfig() {
  if (!hasFirebaseEnv()) return null;

  return {
    apiKey: import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

export function getFirebaseApp() {
  const config = getFirebaseConfig();
  if (!config) return null;
  return getApps().length ? getApps()[0]! : initializeApp(config);
}

let firestoreInitialized = false;

export function getDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!firestoreInitialized) {
    try {
      initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Fall back to the default Firestore instance if persistence isn't available.
    } finally {
      firestoreInitialized = true;
    }
  }
  return getFirestore(app);
}

export function getAuthClient(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}
