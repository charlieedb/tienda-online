"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
  type UserCredential,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthClient } from "@/lib/firebase";
import { preloadUserProfile, reserveUsername, upsertUserProfile } from "@/lib/userProfile";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  firebaseReady: boolean;
  signInEmail: (email: string, password: string) => Promise<UserCredential>;
  signInEmailSession: (email: string, password: string) => Promise<UserCredential>;
  signUpEmail: (email: string, password: string) => Promise<UserCredential>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getAuthClient(), []);
  const [user, setUser] = useState<User | null>(() => auth?.currentUser ?? null);
  const [loading, setLoading] = useState(() => Boolean(auth && !auth.currentUser));

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    setPersistence(auth, browserLocalPersistence).catch(() => {
      // If persistence cannot be set (privacy mode / blocked storage), fall back silently.
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    if (loading) return;
    if (!user) return;

    void preloadUserProfile(user.uid).catch(() => {});
  }, [auth, user, loading]);

  useEffect(() => {
    if (!auth) return;
    if (loading) return;
    if (!user) return;

    const providerIds = new Set(user.providerData.map((p) => p.providerId));
    if (!providerIds.has("google.com")) return;

    (async () => {
      const email = user.email ?? null;
      const displayName = user.displayName ?? null;
      const base =
        (email ? email.split("@")[0] : "") ||
        (displayName ? displayName.split(" ")[0] : "") ||
        "usuario";

      let username = base;
      for (let i = 0; i < 5; i++) {
        try {
          const reserved = await reserveUsername({
            uid: user.uid,
            email,
            username,
          });
          await upsertUserProfile({
            uid: user.uid,
            email,
            username: reserved,
            dni: "",
            displayName,
          });
          return;
        } catch {
          username = `${base}${Math.floor(Math.random() * 900 + 100)}`;
        }
      }
    })();
  }, [auth, user, loading]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      firebaseReady: Boolean(auth),
      signInEmail: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await setPersistence(auth, browserLocalPersistence);
        return signInWithEmailAndPassword(auth, email, password);
      },
      signInEmailSession: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await setPersistence(auth, browserSessionPersistence);
        return signInWithEmailAndPassword(auth, email, password);
      },
      signUpEmail: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await setPersistence(auth, browserLocalPersistence);
        return createUserWithEmailAndPassword(auth, email, password);
      },
      signInGoogle: async () => {
        if (!auth) throw new Error("Firebase no está configurado.");
        const provider = new GoogleAuthProvider();
        try {
          await signInWithPopup(auth, provider);
        } catch {
          await signInWithRedirect(auth, provider);
        }
      },
      signOut: async () => {
        if (!auth) return;
        await auth.signOut();
      },
    };
  }, [auth, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}



