"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { PasswordVisibilityButton } from "@/components/PasswordVisibilityButton";
import { useAuth } from "@/auth/AuthProvider";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { upsertUserProfile } from "@/lib/userProfile";
import { updateProfile } from "firebase/auth";

type Mode = "login" | "signup";

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  onModeChange: (mode: Mode) => void;
  forced?: boolean;
  onUseDemo?: () => void;
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

export function AuthModal({ open, mode, onClose, onModeChange, forced = false, onUseDemo }: Props) {
  useBodyScrollLock(open);

  const { signInEmail, signUpEmail, signInGoogle, firebaseReady } = useAuth();
  const title = useMemo(
    () => (mode === "login" ? "Iniciar sesión" : "Crear cuenta"),
    [mode],
  );

  const demoEnabled = Boolean(onUseDemo) || (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "1" &&
    Boolean(process.env.NEXT_PUBLIC_DEMO_EMAIL) &&
    Boolean(process.env.NEXT_PUBLIC_DEMO_PASSWORD)
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [dni, setDni] = useState("");
  const [preventistaReferido, setPreventistaReferido] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setPassword("");
    setPasswordVisible(false);
    if (mode === "signup") {
      setDni("");
      setPreventistaReferido("");
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
      const emailValue = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) || !password) {
        setError("Completá un correo válido y la contraseña.");
        return;
      }

      if (mode === "login") {
        await signInEmail(emailValue, password);
        onClose();
        return;
      }

      const dniValue = dni.trim();
      const passwordValid = password.length >= 6 && /[a-záéíóúñ]/.test(password) && /[A-ZÁÉÍÓÚÑ]/.test(password) && !password.includes(dniValue);
      if (!/^\d{7,9}$/.test(dniValue)) {
        setError("Ingresá un DNI válido, solo con números.");
        return;
      }
      if (!passwordValid) {
        setError("La contraseña debe cumplir todos los consejos indicados.");
        return;
      }

      const cred = await signUpEmail(emailValue, password);
      const displayName = emailValue.split("@")[0];
      await updateProfile(cred.user, { displayName });
      await upsertUserProfile({
        uid: cred.user.uid,
        email: cred.user.email ?? null,
        username: emailValue.toLowerCase(),
        dni: dniValue,
        displayName,
        preventistaReferido: preventistaReferido.trim(),
      });

      onClose();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dniValid = /^\d{7,9}$/.test(dni.trim());
  const passwordChecks = {
    length: password.length >= 6,
    mixedCase: /[a-záéíóúñ]/.test(password) && /[A-ZÁÉÍÓÚÑ]/.test(password),
    excludesDni: Boolean(password && dniValid && !password.includes(dni.trim())),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            aria-hidden="true"
            className="modal-backdrop-lite fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={forced ? undefined : onClose}
          />

          <motion.aside
            className="fixed left-1/2 top-1/2 z-[75] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border app-modal-surface shadow-2xl"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="text-base font-semibold text-foreground">{title}</div>
              {!forced ? (
                <MotionButton
                  tone="ghost"
                  className="h-9 px-3 !text-foreground/80"
                  onClick={onClose}
                >
                  Cerrar
                </MotionButton>
              ) : null}
            </div>

            <div className="auth-modal-body p-5">
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground/70">
                    Correo electrónico
                  </div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputMode="email"
                    autoComplete="email"
                    className={`app-input w-full rounded-2xl px-4 py-3 text-base ${emailValid ? "app-input--valid" : ""}`}
                    placeholder="tu@email.com"
                  />
                </label>
                {mode === "signup" ? (
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold text-foreground/70">DNI</div>
                    <input
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      autoComplete="off"
                      className={`app-input w-full rounded-2xl px-4 py-3 text-base ${dniValid ? "app-input--valid" : ""}`}
                      placeholder="12345678"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <div className="mb-1 text-xs font-semibold text-foreground/70">Contraseña</div>
                  <div className="auth-password-field">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={passwordVisible ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className={`app-input w-full rounded-2xl px-4 py-3 text-base ${passwordValid || (mode === "login" && password) ? "app-input--valid" : ""}`}
                    />
                    <PasswordVisibilityButton visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} />
                  </div>
                </label>

                {mode === "signup" ? (
                  <>
                    <ul className="app-password-tips" aria-label="Requisitos de contraseña">
                      <li className={passwordChecks.length ? "is-complete" : ""}><span aria-hidden="true">✓</span>Mínimo 6 caracteres</li>
                      <li className={passwordChecks.mixedCase ? "is-complete" : ""}><span aria-hidden="true">✓</span>Usá al menos una mayúscula y una minúscula</li>
                      <li className={passwordChecks.excludesDni ? "is-complete" : ""}><span aria-hidden="true">✓</span>No uses tu DNI</li>
                    </ul>
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold text-foreground/70">
                        Preventista de JOMA <span className="font-normal">(opcional)</span>
                      </div>
                      <input
                        value={preventistaReferido}
                        onChange={(e) => setPreventistaReferido(e.target.value)}
                        autoComplete="off"
                        className={`app-input w-full rounded-2xl px-4 py-3 text-base ${preventistaReferido.trim() ? "app-input--valid" : ""}`}
                      />
                      <div className="mt-1 text-xs text-foreground/60">
                        Completalo si ya te atiende un preventista de Joma.
                      </div>
                    </label>
                  </>
                ) : null}

                {error ? (
                  <div className="app-error rounded-2xl px-4 py-3 text-sm font-semibold">
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
                    className="h-11 !text-foreground/80"
                    onClick={async () => {
                      if (onUseDemo) {
                        onUseDemo();
                        onClose();
                        return;
                      }
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

              <div className="mt-4 text-center text-sm text-foreground/70">
                {mode === "login" ? (
                  <>
                    ¿No tenés cuenta?{" "}
                    <button
                      type="button"
                      className="font-semibold text-[#457B9D] underline underline-offset-4"
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
                      className="font-semibold text-[#457B9D] underline underline-offset-4"
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


