import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { APP_VERSION } from "@/lib/appVersion";
import { PasswordVisibilityButton } from "./PasswordVisibilityButton";

function resetError(error: unknown) {
  const value = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (value.includes("expired-action-code")) return "El enlace venció. Solicitá uno nuevo desde el inicio de sesión.";
  if (value.includes("invalid-action-code")) return "El enlace ya fue usado o no es válido. Solicitá uno nuevo.";
  if (value.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  return "No pudimos restaurar la contraseña. Solicitá un enlace nuevo.";
}

export function PasswordResetPage({ code }: { code: string }) {
  const { confirmCustomerPasswordReset } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const valid = password.length >= 6 && password === confirmation;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!valid) { setError("Usá al menos 6 caracteres y verificá que ambas contraseñas coincidan."); return; }
    setBusy(true);
    try {
      await confirmCustomerPasswordReset(code, password);
      setComplete(true);
    } catch (nextError) {
      setError(resetError(nextError));
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-welcome">
    <div className="auth-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <motion.section className="auth-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
      <div className="auth-brand"><img src="/joma-express-black.png" alt="JOMA Express" width="800" height="329"/></div>
      <div className="auth-form">
        <div className="auth-form-title"><span>Cuenta JOMA</span><h1>{complete ? "Contraseña actualizada" : "Creá tu nueva contraseña"}</h1><p>{complete ? "Ya podés volver a ingresar a tu cuenta." : "Elegí una contraseña de al menos 6 caracteres."}</p></div>
        {complete ? <div className="auth-reset-success" role="status"><strong>Cambio confirmado</strong><span>Tu acceso quedó actualizado correctamente.</span></div> : <form className="auth-reset-fields" onSubmit={submit}>
          <label><span>Nueva contraseña</span><div className="auth-password-field"><input value={password} onChange={(event) => setPassword(event.target.value)} type={visible ? "text" : "password"} autoComplete="new-password" autoFocus/><PasswordVisibilityButton visible={visible} onToggle={() => setVisible((current) => !current)}/></div></label>
          <label><span>Repetir contraseña</span><input className={confirmation && valid ? "is-valid" : ""} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={visible ? "text" : "password"} autoComplete="new-password"/></label>
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? <><span className="auth-spinner"/> Guardando…</> : "Guardar contraseña"}</button>
        </form>}
        {complete ? <a className="auth-primary auth-login-link" href="/?login=1&mode=login">Iniciar sesión</a> : null}
      </div>
      <small className="auth-version">Beta {APP_VERSION}</small>
    </motion.section>
  </main>;
}
