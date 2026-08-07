import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { APP_VERSION } from "@/lib/appVersion";
import { getCachedUserProfile, refreshUserProfile, upsertUserProfile, type UserProfile } from "@/lib/userProfile";
import { Icon } from "./Icons";

type Profile = { name: string; email: string; phone: string; address: string; city: string; notes: string };
const EMPTY_PROFILE: Profile = { name: "", email: "", phone: "", address: "", city: "", notes: "" };

function toForm(profile: UserProfile | null, email = ""): Profile {
  const address = profile?.direcciones?.[0];
  return {
    name: [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim(),
    email: profile?.email || email,
    phone: profile?.telefono || "",
    address: address?.direccion || "",
    city: address?.localidad || "",
    notes: profile?.notes || "",
  };
}

export function ProfileView() {
  const { user, changePassword } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState({ current: false, next: false, confirm: false });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const cached = getCachedUserProfile(user.uid);
    setProfile(toForm(cached, user.email || ""));
    let active = true;
    refreshUserProfile(user.uid).then((remote) => {
      if (active) setProfile(toForm(remote, user.email || ""));
    });
    return () => { active = false; };
  }, [user]);

  const update = (key: keyof Profile, value: string) => {
    setSaved(false); setError("");
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return setError("Necesitás iniciar sesión para guardar tus datos.");
    if (!profile.name.trim() || !profile.phone.trim() || !profile.address.trim()) {
      return setError("Completá nombre, teléfono y dirección.");
    }
    setSaving(true); setError("");
    try {
      const current = getCachedUserProfile(user.uid);
      await upsertUserProfile({
        uid: user.uid,
        email: user.email,
        username: current?.username || user.email?.split("@")[0] || `usuario_${user.uid.slice(0, 8)}`,
        dni: current?.dni || "",
        displayName: current?.displayName || user.displayName,
        preventistaReferido: current?.preventistaReferido || "",
        nombre: profile.name.trim(), apellido: "", telefono: profile.phone.trim(), notes: profile.notes.trim(),
        direcciones: [{ id: "principal", provincia: "", localidad: profile.city.trim(), direccion: profile.address.trim(), ubicacion: null }],
      });
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos guardar tus datos.");
    } finally { setSaving(false); }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError("Completá los tres campos.");
    if (newPassword.length < 6) return setPasswordError("La contraseña nueva debe tener al menos 6 caracteres.");
    if (newPassword !== confirmPassword) return setPasswordError("La contraseña nueva y su confirmación no coinciden.");
    if (currentPassword === newPassword) return setPasswordError("Elegí una contraseña diferente de la actual.");
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordVisible({ current: false, next: false, confirm: false });
      setPasswordSaved(true);
    } catch (nextError) {
      const code = (nextError as { code?: string })?.code;
      setPasswordError(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "La contraseña actual no es correcta."
          : code === "auth/weak-password"
            ? "La contraseña nueva es demasiado débil."
            : code === "auth/too-many-requests"
              ? "Hiciste demasiados intentos. Esperá unos minutos y probá nuevamente."
              : "No pudimos cambiar la contraseña. Intentá nuevamente.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const hasPasswordProvider = user?.providerData.some((provider) => provider.providerId === "password") ?? false;

  return <section className="profile-page">
    <div className="profile-intro"><div className="profile-avatar"><Icon name="user"/></div><div><span>Tu cuenta</span><h1>Mis datos</h1><p>Completalos una vez para agilizar tus próximos pedidos.</p></div></div>
    <form className="profile-form" onSubmit={save}>
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <div className="profile-section profile-section--personal"><div className="profile-section-title"><strong>Información personal</strong><small>Cómo podemos contactarte</small></div>
        <label><span>Nombre y apellido</span><input required value={profile.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" placeholder="Ej. Ana González"/></label>
        <label><span>Email</span><input value={profile.email} readOnly autoComplete="email" type="email"/></label>
        <label><span>Teléfono</span><input required value={profile.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="11 2345 6789"/></label>
      </div>
      <div className="profile-section profile-section--delivery"><div className="profile-section-title"><strong>Entrega</strong><small>Dónde querés recibir tu compra</small></div>
        <label><span>Dirección</span><input required value={profile.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" placeholder="Calle, número, piso o departamento"/></label>
        <label><span>Localidad</span><input value={profile.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" placeholder="Tu localidad"/></label>
        <label><span>Indicaciones para la entrega <em>Opcional</em></span><textarea value={profile.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Timbre, entrecalles o alguna referencia" rows={3}/></label>
      </div>
      <button className={`profile-save ${saved ? "is-saved" : ""}`} type="submit" disabled={saving}>{saving ? "Guardando…" : saved ? <><Icon name="check"/> Datos guardados</> : "Guardar mis datos"}</button>
    </form>
    <section className="profile-section profile-security">
      <div className="profile-section-title"><strong>Seguridad</strong><small>Cambiá tu contraseña de acceso</small></div>
      {hasPasswordProvider ? <form className="profile-password-form" onSubmit={savePassword}>
        <ProfilePasswordField label="Contraseña actual" value={currentPassword} visible={passwordVisible.current} autoComplete="current-password" onChange={(value) => { setCurrentPassword(value); setPasswordError(""); setPasswordSaved(false); }} onToggle={() => setPasswordVisible((state) => ({ ...state, current: !state.current }))}/>
        <ProfilePasswordField label="Nueva contraseña" value={newPassword} visible={passwordVisible.next} autoComplete="new-password" onChange={(value) => { setNewPassword(value); setPasswordError(""); setPasswordSaved(false); }} onToggle={() => setPasswordVisible((state) => ({ ...state, next: !state.next }))}/>
        <ProfilePasswordField label="Confirmar contraseña" value={confirmPassword} visible={passwordVisible.confirm} autoComplete="new-password" onChange={(value) => { setConfirmPassword(value); setPasswordError(""); setPasswordSaved(false); }} onToggle={() => setPasswordVisible((state) => ({ ...state, confirm: !state.confirm }))}/>
        {passwordError ? <div className="checkout-error" role="alert">{passwordError}</div> : null}
        {passwordSaved ? <div className="profile-password-success" role="status"><Icon name="check"/> Contraseña actualizada correctamente.</div> : null}
        <button className="profile-password-save" type="submit" disabled={passwordSaving}>{passwordSaving ? "Actualizando…" : "Cambiar contraseña"}</button>
      </form> : <p className="profile-provider-note">Tu cuenta usa Google. La contraseña se administra desde tu cuenta de Google.</p>}
    </section>
    <div className="profile-version">JOMA Express · Beta {APP_VERSION}</div>
  </section>;
}

function ProfilePasswordField({ label, value, visible, autoComplete, onChange, onToggle }: { label: string; value: string; visible: boolean; autoComplete: "current-password" | "new-password"; onChange: (value: string) => void; onToggle: () => void }) {
  return <label><span>{label}</span><div className="profile-password-input"><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} spellCheck={false}/><button type="button" onClick={onToggle} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible}><EyeIcon crossed={visible}/></button></div></label>;
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{crossed ? <path d="m4 4 16 16"/> : null}</svg>;
}
