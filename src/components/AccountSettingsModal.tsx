"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  getUserProfile,
  upsertUserProfile,
  type LatLng,
  type UserAddress,
  type UserProfile,
} from "@/lib/userProfile";
import { MapPickerModal } from "@/components/MapPickerModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type AddressForm = UserAddress;

type FormState = {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  direcciones: AddressForm[];
};

function newId() {
  return `addr_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBodyScrollLock(open);

  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty: FormState = useMemo(
    () => ({
      nombre: "",
      apellido: "",
      dni: "",
      telefono: "",
      direcciones: [],
    }),
    [],
  );

  const [form, setForm] = useState<FormState>(empty);
  const [baseProfile, setBaseProfile] =
    useState<Pick<UserProfile, "uid" | "email" | "username" | "displayName"> | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [mapAddressId, setMapAddressId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [mapInitialQuery, setMapInitialQuery] = useState("");

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

        const direcciones = (p?.direcciones ?? []).length
          ? (p?.direcciones ?? [])
          : [
              {
                id: "principal",
                provincia: "",
                localidad: "",
                direccion: "",
                ubicacion: null,
              },
            ];

        setForm({
          nombre: p?.nombre ?? "",
          apellido: p?.apellido ?? "",
          dni: p?.dni ?? "",
          telefono: p?.telefono ?? "",
          direcciones,
        });
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

  const activeAddress = useMemo(() => {
    if (!mapAddressId) return null;
    return form.direcciones.find((d) => d.id === mapAddressId) ?? null;
  }, [form.direcciones, mapAddressId]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              aria-label="Cerrar"
              className="modal-backdrop-lite fixed inset-0 z-[70]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.div
              className="fixed left-1/2 top-1/2 z-[75] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border app-modal-surface shadow-2xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold text-foreground">Configuración</div>
                <div className="mt-1 text-xs text-foreground/70">Actualizá tus datos para el envío.</div>
              </div>

              <div className="no-scrollbar max-h-[70dvh] overflow-auto px-5 py-4">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-border bg-white/82 p-4 text-sm text-foreground/70">
                    Cargando...
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {error ? (
                      <div className="app-error rounded-2xl p-3 text-sm font-semibold text-red-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Nombre">
                        <input
                          className="app-input h-11 w-full rounded-2xl px-4 text-[16px]"
                          value={form.nombre}
                          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                          placeholder="Tu nombre"
                        />
                      </Field>
                      <Field label="Apellido">
                        <input
                          className="app-input h-11 w-full rounded-2xl px-4 text-[16px]"
                          value={form.apellido}
                          onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                          placeholder="Tu apellido"
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="DNI">
                        <input
                          className="app-input h-11 w-full rounded-2xl px-4 text-[16px]"
                          value={form.dni}
                          onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
                          placeholder="Documento"
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Teléfono">
                        <input
                          className="app-input h-11 w-full rounded-2xl px-4 text-[16px]"
                          value={form.telefono}
                          onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                          placeholder="WhatsApp / celular"
                          inputMode="tel"
                        />
                      </Field>
                    </div>

                    <div className="rounded-3xl border border-border bg-white/82 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">Direcciones</div>
                          <div className="mt-1 text-xs font-semibold text-foreground/60">
                            Guardá una o varias direcciones para elegir al pedir.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              direcciones: [
                                ...p.direcciones,
                                { id: newId(), provincia: "", localidad: "", direccion: "", ubicacion: null },
                              ],
                            }))
                          }
                          className="h-9 rounded-2xl bg-[#1D3557] px-3 text-xs font-black text-white"
                        >
                          Agregar otra dirección
                        </button>
                      </div>

                      <div className="mt-3 flex flex-col gap-3">
                        {form.direcciones.map((addr, idx) => (
                          <div
                            key={addr.id}
                            className="rounded-3xl border border-border bg-white/88 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-xs font-black text-foreground/70">
                                Dirección {idx + 1}
                              </div>
                              {form.direcciones.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      direcciones: p.direcciones.filter((d) => d.id !== addr.id),
                                    }))
                                  }
                                  className="rounded-xl px-2 py-1 text-xs font-black text-foreground/60 hover:bg-[rgba(69,123,157,0.10)]"
                                >
                                  Quitar
                                </button>
                              ) : null}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Field label="Localidad">
                                <input
                                  className="app-input h-11 w-full rounded-2xl px-4 text-[16px]"
                                  value={addr.localidad}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setForm((p) => ({
                                      ...p,
                                      direcciones: p.direcciones.map((d) =>
                                        d.id === addr.id ? { ...d, localidad: v } : d,
                                      ),
                                    }));
                                  }}
                                  placeholder="Barrio / ciudad"
                                />
                              </Field>

                              <Field label="Dirección">
                                <div className="relative">
                                  <input
                                    className="app-input h-11 w-full rounded-2xl px-4 pr-12 text-[16px]"
                                    value={addr.direccion}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((p) => ({
                                        ...p,
                                        direcciones: p.direcciones.map((d) =>
                                          d.id === addr.id ? { ...d, direccion: v } : d,
                                        ),
                                      }));
                                    }}
                                    placeholder="Calle y número"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMapAddressId(addr.id);
                                      setMapOpen(true);
                                      setMapCenter(addr.ubicacion);
                                      const q = `${addr.direccion}${addr.localidad ? `, ${addr.localidad}` : ""}`.trim();
                                      setMapInitialQuery(q);
                                    }}
                                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl bg-[rgba(69,123,157,0.10)] text-foreground/70 hover:bg-[rgba(69,123,157,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]"
                                    aria-label="Marcar ubicación en el mapa"
                                    title="Marcar ubicación en el mapa"
                                  >
                                    <span className="relative">
                                      <PinIcon />
                                      {addr.ubicacion ? (
                                        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-sm">
                                          ✓
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                </div>
                              </Field>
                            </div>

                            <div className="mt-2 text-xs font-semibold text-foreground/70">
                              {addr.ubicacion
                                ? `Ubicación: ${addr.ubicacion.lat.toFixed(5)}, ${addr.ubicacion.lng.toFixed(5)}`
                                : "Sin ubicación"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-2xl bg-[rgba(69,123,157,0.10)] px-4 text-sm font-black text-foreground"
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
                          direcciones: form.direcciones,
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
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <MapPickerModal
        open={mapOpen}
        initial={activeAddress?.ubicacion ?? null}
        center={mapCenter}
        initialQuery={mapInitialQuery}
        onClose={() => setMapOpen(false)}
        onPick={(p) => {
          if (!mapAddressId) return;
          setForm((prev) => ({
            ...prev,
            direcciones: prev.direcciones.map((d) => (d.id === mapAddressId ? { ...d, ubicacion: p } : d)),
          }));
        }}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-foreground/70">{label}</span>
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


