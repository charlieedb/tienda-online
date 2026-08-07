import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { APP_VERSION } from "@/lib/appVersion";
import { upsertUserProfile } from "@/lib/userProfile";
import { updateProfile } from "firebase/auth";
import { Icon } from "./Icons";
import { PasswordVisibilityButton } from "./PasswordVisibilityButton";

type Mode = "welcome" | "login" | "signup";

function friendlyError(error: unknown) {
  const value = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (value.includes("invalid-credential") || value.includes("wrong-password")) return "El email o la contraseña no son correctos.";
  if (value.includes("user-not-found")) return "No encontramos una cuenta con ese email.";
  if (value.includes("email-already-in-use")) return "Ese email ya tiene una cuenta.";
  if (value.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (value.includes("invalid-email")) return "Ingresá un email válido.";
  if (value.includes("network-request-failed")) return "Revisá tu conexión e intentá nuevamente.";
  if (value.includes("no está configurado")) return "La autenticación todavía no está configurada.";
  return "No pudimos completar la operación. Intentá nuevamente.";
}

export function AuthLoading() {
  return <main className="auth-loading" aria-label="Cargando sesión"><img src="/joma-express-black.png" alt="JOMA Express"/><span className="auth-spinner"/></main>;
}

export function AuthWelcome() {
  const { signInEmail, signUpEmail, firebaseReady } = useAuth();
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [dni, setDni] = useState("");
  const [preventistaReferido, setPreventistaReferido] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dniValid = /^\d{7,9}$/.test(dni.trim());
  const passwordChecks = {
    length: password.length >= 6,
    mixedCase: /[a-záéíóúñ]/.test(password) && /[A-ZÁÉÍÓÚÑ]/.test(password),
    excludesDni: Boolean(password && dniValid && !password.includes(dni.trim())),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const changeMode = (next: Mode) => { setMode(next); setError(""); setPassword(""); setPasswordVisible(false); setDni(""); setPreventistaReferido(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!firebaseReady) { setError("La autenticación todavía no está configurada."); return; }
    if (!emailValid || !password) { setError("Completá un correo válido y la contraseña."); return; }
    if (mode === "signup" && !dniValid) { setError("Ingresá un DNI válido, solo con números."); return; }
    if (mode === "signup" && !passwordValid) { setError("La contraseña debe cumplir todos los consejos indicados."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const credential = await signUpEmail(email.trim(), password);
        const internalUsername = email.trim().toLowerCase();
        const displayName = email.trim().split("@")[0];
        await updateProfile(credential.user, { displayName });
        await upsertUserProfile({
          uid: credential.user.uid,
          email: credential.user.email,
          username: internalUsername,
          dni: dni.trim(),
          displayName,
          preventistaReferido: preventistaReferido.trim(),
        });
      } else await signInEmail(email.trim(), password);
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-welcome">
    <div className="auth-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <motion.section className="auth-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32 }}>
      <div className="auth-brand"><img src="/joma-express-black.png" alt="JOMA Express" width="800" height="329"/></div>
      <AnimatePresence mode="wait" initial={false}>
        {mode === "welcome" ? <motion.div className="welcome-copy" key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }}>
          <span>Bienvenido</span>
          <h1>Tu compra empieza acá.</h1>
          <p>Entrá a tu cuenta para explorar productos, guardar tus datos y armar el carrito.</p>
          <div className="welcome-actions"><button type="button" className="auth-primary" onClick={() => changeMode("login")}>Iniciar sesión</button><button type="button" className="auth-secondary" onClick={() => changeMode("signup")}>Crear una cuenta</button></div>
        </motion.div> : <motion.form className="auth-form" key={mode} onSubmit={submit} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          <button type="button" className="auth-back" onClick={() => changeMode("welcome")}><Icon name="arrow"/> Volver</button>
          <div className="auth-form-title"><span>{mode === "login" ? "Qué bueno verte" : "Empecemos"}</span><h1>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1><p>{mode === "login" ? "Ingresá tus datos para continuar." : "Creá tu acceso en menos de un minuto."}</p></div>
          <label><span>Correo electrónico</span><input className={emailValid ? "is-valid" : ""} value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" autoFocus/></label>
          {mode === "signup" ? <>
            <label><span>DNI</span><input className={dniValid ? "is-valid" : ""} value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="off" placeholder="12345678"/></label>
          </> : null}
          <label><span>Contraseña</span><div className="auth-password-field"><input className={passwordValid || (mode === "login" && password.length > 0) ? "is-valid" : ""} value={password} onChange={(event) => setPassword(event.target.value)} type={passwordVisible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"}/><PasswordVisibilityButton visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} /></div></label>
          {mode === "signup" ? <>
            <ul className="auth-password-tips" aria-label="Requisitos de contraseña">
              <li className={passwordChecks.length ? "is-complete" : ""}><span aria-hidden="true">✓</span>Mínimo 6 caracteres</li>
              <li className={passwordChecks.mixedCase ? "is-complete" : ""}><span aria-hidden="true">✓</span>Usá al menos una mayúscula y una minúscula</li>
              <li className={passwordChecks.excludesDni ? "is-complete" : ""}><span aria-hidden="true">✓</span>No uses tu DNI</li>
            </ul>
            <label><span>Preventista de JOMA <small>(opcional)</small></span><input className={preventistaReferido.trim() ? "is-valid" : ""} value={preventistaReferido} onChange={(event) => setPreventistaReferido(event.target.value)} autoComplete="off"/><small className="auth-field-help">Completalo si ya te atiende un preventista de Joma.</small></label>
          </> : null}
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? <><span className="auth-spinner"/> Procesando…</> : mode === "login" ? "Entrar" : "Crear mi cuenta"}</button>
          <button type="button" className="auth-switch" onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "No tengo cuenta · Crear una" : "Ya tengo cuenta · Iniciar sesión"}</button>
        </motion.form>}
      </AnimatePresence>
      <small className="auth-version">Beta {APP_VERSION}</small>
    </motion.section>
  </main>;
}
