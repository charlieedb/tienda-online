"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";

const ACCESS_ENDPOINT = "https://us-central1-app-presu.cloudfunctions.net/manageStoreAdminAccess";

export function AdminUsersPanel() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function request(method: "GET" | "POST" | "DELETE", targetEmail?: string) {
    if (!user) throw new Error("La sesión ya no está disponible.");
    const token = await user.getIdToken();
    const response = await fetch(ACCESS_ENDPOINT, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify({ email: targetEmail }) }),
    });
    const result = await response.json().catch(() => null) as { emails?: string[]; error?: string } | null;
    if (!response.ok) throw new Error(result?.error || "No se pudo actualizar la lista de acceso.");
    return result?.emails || [];
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextEmails = await request("GET");
        if (!cancelled) setEmails(nextEmails);
      } catch (error) {
        if (!cancelled) setMessage(String((error as Error)?.message || error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);

  async function addEmail() {
    const normalized = email.trim().toLowerCase();
    if (!normalized || savingEmail) return;
    setSavingEmail(normalized);
    setMessage("");
    try {
      setEmails(await request("POST", normalized));
      setEmail("");
      setMessage("Correo autorizado correctamente.");
    } catch (error) {
      setMessage(String((error as Error)?.message || error));
    } finally {
      setSavingEmail(null);
    }
  }

  async function removeEmail(targetEmail: string) {
    if (savingEmail || !window.confirm(`¿Quitar el acceso de ${targetEmail}?`)) return;
    setSavingEmail(targetEmail);
    setMessage("");
    try {
      setEmails(await request("DELETE", targetEmail));
      setMessage("Acceso eliminado.");
    } catch (error) {
      setMessage(String((error as Error)?.message || error));
    } finally {
      setSavingEmail(null);
    }
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <section className="admin-users-box">
      <header className="admin-users-head">
        <div>
          <h1>Accesos al panel</h1>
          <p>Solo las cuentas de Google incluidas en esta lista pueden administrar la tienda.</p>
        </div>
      </header>

      <div className="admin-users-layout">
        <div className="admin-users-form">
          <h2>Autorizar otro correo</h2>
          <label>
            <span>Correo de Google</span>
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && validEmail) void addEmail(); }}
              placeholder="nombre@gmail.com"
              autoComplete="email"
              disabled={Boolean(savingEmail)}
            />
          </label>
          <p className="admin-users-hint">La persona deberá elegir exactamente esta cuenta al pulsar “Acceder con Google”.</p>
          {message ? <div className="admin-users-message" role="status">{message}</div> : null}
          <div className="admin-users-form__actions">
            <button type="button" className="btn primary" onClick={() => void addEmail()} disabled={!validEmail || Boolean(savingEmail)}>
              {savingEmail === email.trim().toLowerCase() ? "Autorizando..." : "Autorizar correo"}
            </button>
          </div>
        </div>

        <div className="admin-users-list">
          <div className="admin-users-list__head">
            <h2>Correos autorizados</h2>
            <span>{emails.length}</span>
          </div>
          {loading ? <p>Cargando accesos...</p> : emails.map((entry) => (
            <article key={entry}>
              <div>
                <strong>{entry}</strong>
                <span>{entry === user?.email?.toLowerCase() ? "Tu cuenta actual" : "Acceso mediante Google"}</span>
              </div>
              <div className="admin-user-actions">
                <button
                  type="button"
                  className="admin-user-delete"
                  onClick={() => void removeEmail(entry)}
                  disabled={Boolean(savingEmail) || emails.length === 1}
                >
                  {savingEmail === entry ? "Quitando..." : "Quitar acceso"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
