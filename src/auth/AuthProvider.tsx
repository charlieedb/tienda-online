"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthClient } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  firebaseReady: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getAuthClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Ensure the session persists across refreshes and browser restarts.
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // If persistence cannot be set (privacy mode / blocked storage), fall back silently.
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      firebaseReady: Boolean(auth),
      signInEmail: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUpEmail: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await createUserWithEmailAndPassword(auth, email, password);
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
