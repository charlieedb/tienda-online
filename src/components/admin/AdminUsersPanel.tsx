"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";

type ManagedUser = {
  username: string;
  active: boolean;
  name: string;
  email: string;
  lastLogin: string;
};

function formatLastLogin(value: string) {
  if (!value) return "Nunca";
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AdminUsersPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ username: "", name: "", email: "", password: "" });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);

  async function loadUsers() {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("https://us-central1-app-presu.cloudfunctions.net/manageAdminOperators", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as { users?: Array<{ username: string; active: boolean; name: string; email: string; lastLoginAtIso: string }> };
      setUsers((result.users || []).map((entry) => ({ ...entry, lastLogin: formatLastLogin(entry.lastLoginAtIso) })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function saveUser() {
    if (!user || form.username.trim().length < 3 || form.password.length < 6) return;
    setSaving(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        "https://us-central1-app-presu.cloudfunctions.net/manageAdminOperators",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: form.username.trim(),
            password: form.password,
            active: true,
            name: form.name.trim(),
            email: form.email.trim(),
          }),
        },
      );
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "No se pudo guardar el usuario.");
      setForm({ username: "", name: "", email: "", password: "" });
      setEditingUsername(null);
      setMessage("Usuario guardado correctamente.");
      await loadUsers();
    } catch (error) {
      setMessage(String((error as Error)?.message || "No se pudo guardar el usuario."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(entry: ManagedUser) {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("https://us-central1-app-presu.cloudfunctions.net/manageAdminOperators", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: entry.username, name: entry.name, email: entry.email, active: !entry.active }),
    });
    await loadUsers();
  }

  function editUser(entry: ManagedUser) {
    setEditingUsername(entry.username);
    setForm({ username: entry.username, name: entry.name, email: entry.email, password: "" });
    setMessage("");
  }

  async function deleteUser(entry: ManagedUser) {
    if (!user || !window.confirm(`¿Eliminar el operador ${entry.username}?`)) return;
    const token = await user.getIdToken();
    const response = await fetch("https://us-central1-app-presu.cloudfunctions.net/manageAdminOperators", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: entry.username }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(result?.error || "No se pudo eliminar el usuario.");
      return;
    }
    if (editingUsername === entry.username) {
      setEditingUsername(null);
      setForm({ username: "", name: "", email: "", password: "" });
    }
    await loadUsers();
  }

  return (
    <section className="admin-users-box">
      <header className="admin-users-head">
        <div>
          <h1>Usuarios</h1>
          <p>Usuarios exclusivos del administrador de tienda. No comparten cuentas ni permisos con Preventistas.</p>
        </div>
      </header>

      <div className="admin-users-layout">
        <div className="admin-users-form">
          <h2>{editingUsername ? `Editar @${editingUsername}` : "Agregar usuario"}</h2>
          <label>
            <span>Usuario</span>
            <input className="admin-input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} autoComplete="off" disabled={Boolean(editingUsername)} />
          </label>
          <label>
            <span>Nombre</span>
            <input className="admin-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="off" />
          </label>
          <label>
            <span>Email de recuperación</span>
            <input className="admin-input" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" />
          </label>
          <label>
            <span>{editingUsername ? "Nueva contraseña (opcional)" : "Contraseña"}</span>
            <input className="admin-input" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" placeholder={editingUsername ? "Dejar vacío para conservarla" : ""} />
          </label>
          {message ? <div className="admin-users-message">{message}</div> : null}
          <div className="admin-users-form__actions">
            {editingUsername ? (
              <button type="button" className="btn ghost" onClick={() => { setEditingUsername(null); setForm({ username: "", name: "", email: "", password: "" }); }}>
                Cancelar
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={() => void saveUser()} disabled={saving || form.username.trim().length < 3 || !form.email.includes("@") || (!editingUsername && form.password.length < 6) || (Boolean(form.password) && form.password.length < 6)}>
              {saving ? "Guardando..." : editingUsername ? "Guardar cambios" : "Guardar usuario"}
            </button>
          </div>
        </div>

        <div className="admin-users-list">
          <div className="admin-users-list__head">
            <h2>Usuarios registrados</h2>
            <span>{users.length}</span>
          </div>
          {loading ? <p>Cargando usuarios...</p> : users.map((entry) => (
            <article key={entry.username}>
              <div>
                <strong>{entry.name || entry.username}</strong>
                <span>@{entry.username} · {entry.email} · Último acceso: {entry.lastLogin}</span>
              </div>
              <div className="admin-user-actions">
                <button type="button" className="admin-user-edit" onClick={() => editUser(entry)}>Editar</button>
                <button type="button" className={`admin-user-state ${entry.active ? "is-active" : ""}`} onClick={() => void toggleUser(entry)}>
                  {entry.active ? "Activo" : "Desactivado"}
                </button>
                <button type="button" className="admin-user-delete" onClick={() => void deleteUser(entry)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
