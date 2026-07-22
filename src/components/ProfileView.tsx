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
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        nombre: profile.name.trim(), apellido: "", telefono: profile.phone.trim(), notes: profile.notes.trim(),
        direcciones: [{ id: "principal", provincia: "", localidad: profile.city.trim(), direccion: profile.address.trim(), ubicacion: null }],
      });
      setSaved(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos guardar tus datos.");
    } finally { setSaving(false); }
  };

  return <section className="profile-page">
    <div className="profile-intro"><div className="profile-avatar"><Icon name="user"/></div><div><span>Tu cuenta</span><h1>Mis datos</h1><p>Completalos una vez para agilizar tus próximos pedidos.</p></div></div>
    <form className="profile-form" onSubmit={save}>
      {error ? <div className="checkout-error" role="alert">{error}</div> : null}
      <div className="profile-section"><div className="profile-section-title"><strong>Información personal</strong><small>Cómo podemos contactarte</small></div>
        <label><span>Nombre y apellido</span><input required value={profile.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" placeholder="Ej. Ana González"/></label>
        <label><span>Email</span><input value={profile.email} readOnly autoComplete="email" type="email"/></label>
        <label><span>Teléfono</span><input required value={profile.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="11 2345 6789"/></label>
      </div>
      <div className="profile-section"><div className="profile-section-title"><strong>Entrega</strong><small>Dónde querés recibir tu compra</small></div>
        <label><span>Dirección</span><input required value={profile.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" placeholder="Calle, número, piso o departamento"/></label>
        <label><span>Localidad</span><input value={profile.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" placeholder="Tu localidad"/></label>
        <label><span>Indicaciones para la entrega <em>Opcional</em></span><textarea value={profile.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Timbre, entrecalles o alguna referencia" rows={3}/></label>
      </div>
      <button className={`profile-save ${saved ? "is-saved" : ""}`} type="submit" disabled={saving}>{saving ? "Guardando…" : saved ? <><Icon name="check"/> Datos guardados</> : "Guardar mis datos"}</button>
    </form>
    <div className="profile-version">JOMA Express · Beta {APP_VERSION}</div>
  </section>;
}
