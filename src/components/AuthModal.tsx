"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { useAuth } from "@/auth/AuthProvider";
import {
  reserveUsername,
  resolveEmailFromUsername,
  upsertUserProfile,
} from "@/lib/userProfile";
import { updateProfile } from "firebase/auth";

type Mode = "login" | "signup";

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  onModeChange: (mode: Mode) => void;
  forced?: boolean;
};

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("usuario ya está en uso")) return "Ese usuario ya está en uso.";
  if (m.includes("invalid-credential") || m.includes("wrong-password")) {
    return "Email o contraseña incorrectos.";
  }
  if (m.includes("user-not-found")) return "No existe una cuenta con ese email.";
  if (m.includes("email-already-in-use")) return "Ese email ya está registrado.";
  if (m.includes("weak-password")) return "La contraseña es muy corta (mínimo 6).";
  if (m.includes("invalid-email")) return "El email no es válido.";
  if (m.includes("popup-blocked")) return "El navegador bloqueó el popup. Probá de nuevo.";
  return "No se pudo completar. Probá de nuevo.";
}

export function AuthModal({ open, mode, onClose, onModeChange, forced = false }: Props) {
  const { signInEmail, signUpEmail, signInGoogle, firebaseReady } = useAuth();
  const title = useMemo(
    () => (mode === "login" ? "Iniciar sesión" : "Crear cuenta"),
    [mode],
  );

  const demoEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "1" &&
    Boolean(process.env.NEXT_PUBLIC_DEMO_EMAIL) &&
    Boolean(process.env.NEXT_PUBLIC_DEMO_PASSWORD);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setPassword("");
    if (mode === "signup") {
      setUsername("");
      setDni("");
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (forced) return;
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, forced]);

  const submit = async () => {
    if (!firebaseReady) {
      setError("Falta configurar Firebase (.env.local) para poder iniciar sesión.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const eOrUser = email.trim();
      if (!eOrUser || !password) {
        setError("Completá usuario/email y contraseña.");
        return;
      }

      if (mode === "login") {
        const emailToUse = eOrUser.includes("@")
          ? eOrUser
          : await resolveEmailFromUsername(eOrUser);
        if (!emailToUse) {
          setError("No existe una cuenta con ese usuario.");
          return;
        }
        await signInEmail(emailToUse, password);
        onClose();
        return;
      }

      const emailValue = eOrUser;
      const usernameValue = username.trim();
      const dniValue = dni.trim();
      if (!usernameValue || !dniValue) {
        setError("Completá usuario y DNI.");
        return;
      }

      const cred = await signUpEmail(emailValue, password);
      const reserved = await reserveUsername({
        uid: cred.user.uid,
        email: cred.user.email ?? null,
        username: usernameValue,
      });
      await updateProfile(cred.user, { displayName: reserved });
      await upsertUserProfile({
        uid: cred.user.uid,
        email: cred.user.email ?? null,
        username: reserved,
        dni: dniValue,
        displayName: cred.user.displayName ?? null,
      });

      onClose();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            aria-hidden="true"
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={forced ? undefined : onClose}
          />

          <motion.aside
            className="fixed left-1/2 top-1/2 z-[75] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f3f1f1] shadow-2xl"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="text-base font-semibold text-black">{title}</div>
              {!forced ? (
                <MotionButton
                  tone="ghost"
                  className="h-9 px-3 !text-black/75 hover:!bg-black/5"
                  onClick={onClose}
                >
                  Cerrar
                </MotionButton>
              ) : null}
            </div>

            <div className="p-5">
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-black/70">
                    {mode === "login" ? "Email o usuario" : "Email"}
                  </div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputMode="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/25"
                    placeholder={mode === "login" ? "tu@email.com o usuario" : "tu@email.com"}
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-black/70">Contraseña</div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/25"
                    placeholder="••••••"
                  />
                </label>

                {mode === "signup" ? (
                  <>
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold text-black/70">Usuario</div>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/25"
                        placeholder="tuusuario"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold text-black/70">DNI</div>
                      <input
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                        inputMode="numeric"
                        autoComplete="off"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-black outline-none placeholder:text-black/35 focus:border-black/25"
                        placeholder="12345678"
                      />
                    </label>
                  </>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <MotionButton className="h-11" onClick={submit} disabled={busy}>
                  {mode === "login" ? "Entrar" : "Crear cuenta"}
                </MotionButton>
                <MotionButton
                  tone="soft"
                  className="h-11"
                  onClick={async () => {
                    setError(null);
                    try {
                      setBusy(true);
                      await signInGoogle();
                      onClose();
                    } catch (err) {
                      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                >
                  Continuar con Google
                </MotionButton>

                {demoEnabled ? (
                  <MotionButton
                    tone="ghost"
                    className="h-11 !text-black/75 hover:!bg-black/5"
                    onClick={async () => {
                      setError(null);
                      try {
                        setBusy(true);
                        const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL!;
                        const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD!;
                        try {
                          await signUpEmail(demoEmail, demoPassword);
                        } catch {
                          // If it already exists (or any create error), try sign-in.
                          await signInEmail(demoEmail, demoPassword);
                        }
                        onClose();
                      } catch (err) {
                        setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    Entrar como demo
                  </MotionButton>
                ) : null}
              </div>

              <div className="mt-4 text-center text-sm text-black/70">
                {mode === "login" ? (
                  <>
                    ¿No tenés cuenta?{" "}
                    <button
                      type="button"
                      className="font-semibold text-black underline underline-offset-4"
                      onClick={() => onModeChange("signup")}
                    >
                      Crear cuenta
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tenés cuenta?{" "}
                    <button
                      type="button"
                      className="font-semibold text-black underline underline-offset-4"
                      onClick={() => onModeChange("login")}
                    >
                      Iniciar sesión
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
