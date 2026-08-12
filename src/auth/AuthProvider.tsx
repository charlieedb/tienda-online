"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  verifyPasswordResetCode,
  type User,
  type UserCredential,
} from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthClient } from "@/lib/firebase";
import { preloadUserProfile } from "@/lib/userProfile";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  firebaseReady: boolean;
  signInEmail: (email: string, password: string) => Promise<UserCredential>;
  signInEmailSession: (email: string, password: string) => Promise<UserCredential>;
  signInUsernameSession: (username: string, password: string) => Promise<UserCredential>;
  resetAdminPassword: (username: string) => Promise<void>;
  sendCustomerPasswordReset: (email: string) => Promise<void>;
  confirmCustomerPasswordReset: (code: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<UserCredential>;
  sendVerificationEmail: (user: User) => Promise<void>;
  signInGoogle: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
      signInUsernameSession: async (username, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        const response = await fetch(
          "https://us-central1-app-presu.cloudfunctions.net/loginAdminOperator",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.trim(), password }),
          },
        );
        const result = await response.json().catch(() => null) as {
          ok?: boolean;
          email?: string;
          error?: string;
        } | null;
        if (!response.ok || !result?.email) {
          throw new Error(result?.error || "Usuario o contraseña incorrectos.");
        }
        await setPersistence(auth, browserSessionPersistence);
        return signInWithEmailAndPassword(auth, result.email, password);
      },
      resetAdminPassword: async (username) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        const response = await fetch(
          "https://us-central1-app-presu.cloudfunctions.net/loginAdminOperator",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.trim() }),
          },
        );
        const result = await response.json().catch(() => null) as { email?: string; error?: string } | null;
        if (!response.ok || !result?.email) throw new Error(result?.error || "No encontramos ese usuario.");
        await sendPasswordResetEmail(auth, result.email);
      },
      sendCustomerPasswordReset: async (email) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await sendPasswordResetEmail(auth, email.trim(), {
          url: `${window.location.origin}/?login=1&mode=login`,
          handleCodeInApp: false,
        });
      },
      confirmCustomerPasswordReset: async (code, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await verifyPasswordResetCode(auth, code);
        await confirmPasswordReset(auth, code, password);
      },
      signUpEmail: async (email, password) => {
        if (!auth) throw new Error("Firebase no está configurado.");
        await setPersistence(auth, browserLocalPersistence);
        return createUserWithEmailAndPassword(auth, email, password);
      },
      sendVerificationEmail: async (targetUser) => {
        await sendEmailVerification(targetUser);
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
      changePassword: async (currentPassword, newPassword) => {
        if (!auth?.currentUser?.email) throw new Error("No pudimos identificar tu cuenta.");
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
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



