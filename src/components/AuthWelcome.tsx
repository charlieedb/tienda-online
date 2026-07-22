import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { APP_VERSION } from "@/lib/appVersion";
import { Icon } from "./Icons";

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
  return <main className="auth-loading" aria-label="Cargando sesión"><img src="/joma-express.png" alt="JOMA Express"/><span className="auth-spinner"/></main>;
}

export function AuthWelcome() {
  const { signInEmail, signUpEmail, firebaseReady } = useAuth();
  const [mode, setMode] = useState<Mode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changeMode = (next: Mode) => { setMode(next); setError(""); setPassword(""); setConfirmPassword(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!firebaseReady) { setError("La autenticación todavía no está configurada."); return; }
    if (!email.trim() || !password) { setError("Completá el email y la contraseña."); return; }
    if (mode === "signup" && password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      if (mode === "signup") await signUpEmail(email.trim(), password);
      else await signInEmail(email.trim(), password);
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-welcome">
    <div className="auth-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <motion.section className="auth-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32 }}>
      <div className="auth-brand"><img src="/joma-express.png" alt="JOMA Express" width="561" height="257"/></div>
      <AnimatePresence mode="wait" initial={false}>
        {mode === "welcome" ? <motion.div className="welcome-copy" key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }}>
          <span>Bienvenido</span>
          <h1>Tu compra empieza acá.</h1>
          <p>Entrá a tu cuenta para explorar productos, guardar tus datos y armar el carrito.</p>
          <div className="welcome-actions"><button type="button" className="auth-primary" onClick={() => changeMode("login")}>Iniciar sesión</button><button type="button" className="auth-secondary" onClick={() => changeMode("signup")}>Crear una cuenta</button></div>
        </motion.div> : <motion.form className="auth-form" key={mode} onSubmit={submit} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          <button type="button" className="auth-back" onClick={() => changeMode("welcome")}><Icon name="arrow"/> Volver</button>
          <div className="auth-form-title"><span>{mode === "login" ? "Qué bueno verte" : "Empecemos"}</span><h1>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1><p>{mode === "login" ? "Ingresá tus datos para continuar." : "Creá tu acceso en menos de un minuto."}</p></div>
          <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" autoFocus/></label>
          <label><span>Contraseña</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo 6 caracteres"/></label>
          {mode === "signup" ? <label><span>Repetir contraseña</span><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Volvé a escribirla"/></label> : null}
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? <><span className="auth-spinner"/> Procesando…</> : mode === "login" ? "Entrar" : "Crear mi cuenta"}</button>
          <button type="button" className="auth-switch" onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "No tengo cuenta · Crear una" : "Ya tengo cuenta · Iniciar sesión"}</button>
        </motion.form>}
      </AnimatePresence>
      <small className="auth-version">Beta {APP_VERSION}</small>
    </motion.section>
  </main>;
}
