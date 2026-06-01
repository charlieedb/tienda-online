"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getUserProfile, upsertUserProfile, type UserProfile } from "@/lib/userProfile";
import { MapPickerModal } from "@/components/MapPickerModal";

type FormState = {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  localidad: string;
  direccion: string;
  ubicacion: { lat: number; lng: number } | null;
};

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const empty: FormState = useMemo(
    () => ({
      nombre: "",
      apellido: "",
      dni: "",
      telefono: "",
      localidad: "",
      direccion: "",
      ubicacion: null,
    }),
    [],
  );

  const [form, setForm] = useState<FormState>(empty);
  const [baseProfile, setBaseProfile] = useState<Pick<UserProfile, "uid" | "email" | "username" | "displayName"> | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    if (!user) return;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const p = await getUserProfile(user.uid);
        const email = user.email ?? null;
        const username = p?.username || (email ? email.split("@")[0] : "usuario");
        setBaseProfile({
          uid: user.uid,
          email,
          username,
          displayName: user.displayName ?? p?.displayName ?? null,
        });
        setForm({
          nombre: p?.nombre ?? "",
          apellido: p?.apellido ?? "",
          dni: p?.dni ?? "",
          telefono: p?.telefono ?? "",
          localidad: p?.localidad ?? "",
          direccion: p?.direccion ?? "",
          ubicacion: p?.ubicacion ?? null,
        });
        setMapCenter(p?.ubicacion ?? null);
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar tu perfil.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user, empty]);

  useEffect(() => {
    if (!open) return;
    if (user) return;
    onClose();
  }, [open, user, onClose]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              aria-label="Cerrar"
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.div
              className="fixed left-1/2 top-1/2 z-[75] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f7f4f4] shadow-2xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold text-black">Configuración</div>
                <div className="mt-1 text-xs text-black/70">Actualizá tus datos para el envío.</div>
              </div>

              <div className="no-scrollbar max-h-[70dvh] overflow-auto px-5 py-4">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-border bg-white/70 p-4 text-sm text-black/70">
                    Cargando…
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                        {error}
                      </div>
                    ) : null}

                    <Field label="Nombre">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.nombre}
                        onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                        placeholder="Tu nombre"
                      />
                    </Field>

                    <Field label="Apellido">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.apellido}
                        onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                        placeholder="Tu apellido"
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="DNI">
                        <input
                          className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                          value={form.dni}
                          onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
                          placeholder="Documento"
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Teléfono">
                        <input
                          className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                          value={form.telefono}
                          onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                          placeholder="WhatsApp / celular"
                          inputMode="tel"
                        />
                      </Field>
                    </div>

                    <Field label="Localidad">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.localidad}
                        onChange={(e) => setForm((p) => ({ ...p, localidad: e.target.value }))}
                        placeholder="Barrio / ciudad"
                      />
                    </Field>

                    <Field label="Dirección">
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <input
                            className="h-11 w-full rounded-2xl border border-border bg-white px-4 pr-12 text-[16px] text-black outline-none focus:border-brand/50"
                            value={form.direccion}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, direccion: e.target.value }))
                            }
                            placeholder="Calle y número"
                          />

                          <button
                            type="button"
                            onClick={async () => {
                              if (geoLoading) return;
                              setMapOpen(true);
                              if (form.ubicacion) {
                                setMapCenter(form.ubicacion);
                                return;
                              }
                              const q = `${form.direccion}`.trim()
                                ? `${form.direccion}${form.localidad ? `, ${form.localidad}` : ""}`
                                : `${form.localidad}`.trim();
                              if (!q) return;
                              setGeoLoading(true);
                              try {
                                const url =
                                  "https://nominatim.openstreetmap.org/search?" +
                                  new URLSearchParams({
                                    format: "json",
                                    q,
                                    limit: "1",
                                  }).toString();
                                const res = await fetch(url, {
                                  headers: { Accept: "application/json" },
                                });
                                const data = (await res.json()) as Array<{
                                  lat: string;
                                  lon: string;
                                }>;
                                const first = data?.[0];
                                if (!first) return;
                                const lat = Number(first.lat);
                                const lng = Number(first.lon);
                                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                                setMapCenter({ lat, lng });
                              } catch {
                                // ignore: user can still pick manually
                              } finally {
                                setGeoLoading(false);
                              }
                            }}
                            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl bg-black/5 text-black/70 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/30"
                            aria-label="Marcar ubicación en el mapa"
                            title="Marcar ubicación en el mapa"
                          >
                            {geoLoading ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black/70" />
                            ) : (
                              <span className="relative">
                                <PinIcon />
                                {form.ubicacion ? (
                                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-sm">
                                    ✓
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </button>
                        </div>

                        <div className="text-xs font-semibold text-black/70">
                          {form.ubicacion
                            ? `Ubicación: ${form.ubicacion.lat.toFixed(5)}, ${form.ubicacion.lng.toFixed(5)}`
                            : "Sin ubicación"}
                        </div>
                      </div>
                    </Field>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-2xl bg-black/5 px-4 text-sm font-black text-black"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving || loading || !baseProfile}
                    onClick={async () => {
                      if (!user || !baseProfile) return;
                      setSaving(true);
                      setError(null);
                      try {
                        await upsertUserProfile({
                          uid: baseProfile.uid,
                          email: baseProfile.email,
                          username: baseProfile.username,
                          dni: form.dni,
                          displayName: baseProfile.displayName ?? null,
                          nombre: form.nombre,
                          apellido: form.apellido,
                          telefono: form.telefono,
                          localidad: form.localidad,
                          direccion: form.direccion,
                          ubicacion: form.ubicacion,
                        });
                        onClose();
                      } catch (e: any) {
                        setError(e?.message || "No se pudo guardar.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="h-11 rounded-2xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <MapPickerModal
        open={mapOpen}
        initial={form.ubicacion}
        center={mapCenter}
        onClose={() => setMapOpen(false)}
        onPick={(p) => setForm((prev) => ({ ...prev, ubicacion: p }))}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-black/70">{label}</span>
      {children}
    </label>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 21s7-4.6 7-11a7 7 0 1 0-14 0c0 6.4 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"
        fill="currentColor"
      />
    </svg>
  );
}
