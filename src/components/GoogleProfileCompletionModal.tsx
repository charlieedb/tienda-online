"use client";

import { useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { useAuth } from "@/auth/AuthProvider";
import { upsertUserProfile } from "@/lib/userProfile";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = { open: boolean; onComplete: () => void };

export function GoogleProfileCompletionModal({ open, onComplete }: Props) {
  useBodyScrollLock(open);
  const { user } = useAuth();
  const [dni, setDni] = useState("");
  const [preventistaReferido, setPreventistaReferido] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open || !user) return null;

  const submit = async () => {
    const dniValue = dni.trim();
    if (!/^\d{7,9}$/.test(dniValue)) {
      setError("Ingresá un DNI válido, solo con números.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await upsertUserProfile({
        uid: user.uid,
        email: user.email ?? null,
        username: (user.email ?? user.uid).toLowerCase(),
        dni: dniValue,
        displayName: user.displayName,
        preventistaReferido: preventistaReferido.trim(),
      });
      onComplete();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No pudimos guardar tus datos. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop-lite fixed inset-0 z-[80]" aria-hidden="true" />
      <aside className="app-modal-surface fixed left-1/2 top-1/2 z-[85] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border" role="dialog" aria-modal="true" aria-labelledby="google-profile-title">
        <header className="border-b border-border px-5 py-4">
          <h2 id="google-profile-title" className="text-base font-semibold text-foreground">Completá tu cuenta</h2>
          <p className="mt-1 text-sm text-foreground/65">Necesitamos estos datos antes de que empieces a comprar.</p>
        </header>
        <div className="auth-modal-body space-y-3 p-5">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-foreground/70">DNI</span><input className={`app-input w-full rounded-2xl px-4 py-3 text-base ${/^\d{7,9}$/.test(dni) ? "app-input--valid" : ""}`} value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="off" placeholder="12345678" autoFocus /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-foreground/70">Preventista de JOMA <span className="font-normal">(opcional)</span></span><input className={`app-input w-full rounded-2xl px-4 py-3 text-base ${preventistaReferido.trim() ? "app-input--valid" : ""}`} value={preventistaReferido} onChange={(event) => setPreventistaReferido(event.target.value)} autoComplete="off" /><span className="mt-1 block text-xs text-foreground/60">Completalo si ya te atiende un preventista de Joma.</span></label>
          {error ? <div className="app-error rounded-2xl px-4 py-3 text-sm font-semibold" role="alert">{error}</div> : null}
          <MotionButton className="h-11 w-full" onClick={() => void submit()} disabled={busy}>{busy ? "Guardando..." : "Guardar y continuar"}</MotionButton>
        </div>
      </aside>
    </>
  );
}
