import { useState } from "react";
import { APP_VERSION } from "@/lib/appVersion";
import { Icon } from "./Icons";

type Profile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
};

const STORAGE_KEY = "joma.profile.v1";
const EMPTY_PROFILE: Profile = { name: "", email: "", phone: "", address: "", city: "", notes: "" };

function loadProfile(): Profile {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? { ...EMPTY_PROFILE, ...JSON.parse(value) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export function ProfileView() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [saved, setSaved] = useState(false);
  const update = (key: keyof Profile, value: string) => {
    setSaved(false);
    setProfile((current) => ({ ...current, [key]: value }));
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
  };

  return <section className="profile-page">
    <div className="profile-intro">
      <div className="profile-avatar"><Icon name="user"/></div>
      <div><span>Tu cuenta</span><h1>Mis datos</h1><p>Completalos una vez para agilizar tus próximos pedidos.</p></div>
    </div>
    <form className="profile-form" onSubmit={save}>
      <div className="profile-section"><div className="profile-section-title"><strong>Información personal</strong><small>Cómo podemos contactarte</small></div>
        <label><span>Nombre y apellido</span><input value={profile.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" placeholder="Ej. Ana González"/></label>
        <label><span>Email</span><input value={profile.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" inputMode="email" type="email" placeholder="tu@email.com"/></label>
        <label><span>Teléfono</span><input value={profile.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="11 2345 6789"/></label>
      </div>
      <div className="profile-section"><div className="profile-section-title"><strong>Entrega</strong><small>Dónde querés recibir tu compra</small></div>
        <label><span>Dirección</span><input value={profile.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" placeholder="Calle, número, piso o departamento"/></label>
        <label><span>Localidad</span><input value={profile.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" placeholder="Tu localidad"/></label>
        <label><span>Indicaciones para la entrega <em>Opcional</em></span><textarea value={profile.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Timbre, entrecalles o alguna referencia" rows={3}/></label>
      </div>
      <button className={`profile-save ${saved ? "is-saved" : ""}`} type="submit">{saved ? <><Icon name="check"/> Datos guardados</> : "Guardar mis datos"}</button>
    </form>
    <div className="profile-version">JOMA Express · Beta {APP_VERSION}</div>
  </section>;
}
