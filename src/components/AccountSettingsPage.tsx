"use client";

import { motion } from "framer-motion";
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

type BaseProfile = Pick<UserProfile, "uid" | "email" | "username" | "displayName">;

type SaveError = Error & { message: string };

export function AccountSettingsPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const empty: FormState = useMemo(
    () => ({
      nombre: "",
      apellido: "",
      dni: "",
      telefono: "",
      direcciones: [{ id: "principal", localidad: "", direccion: "", ubicacion: null }],
    }),
    [],
  );

  const [form, setForm] = useState<FormState>(empty);
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [multiAddressEnabled, setMultiAddressEnabled] = useState(false);

  const [mapOpen, setMapOpen] = useState(false);
  const [mapAddressId, setMapAddressId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [mapInitialQuery, setMapInitialQuery] = useState("");

  useEffect(() => {
    if (!user) {
      onBack();
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setError(null);
      setSavedNotice(null);
      setLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) return;

        const email = user.email ?? null;
        const username = profile?.username || (email ? email.split("@")[0] : "usuario");
        const direcciones =
          (profile?.direcciones ?? []).length > 0
            ? (profile?.direcciones ?? [])
            : [{ id: "principal", localidad: "", direccion: "", ubicacion: null }];

        setBaseProfile({
          uid: user.uid,
          email,
          username,
          displayName: user.displayName ?? profile?.displayName ?? null,
        });
        setForm({
          nombre: profile?.nombre ?? "",
          apellido: profile?.apellido ?? "",
          dni: profile?.dni ?? "",
          telefono: profile?.telefono ?? "",
          direcciones,
        });
        setMultiAddressEnabled(direcciones.length > 1);
      } catch (unknownError) {
        if (cancelled) return;
        const e = unknownError as SaveError;
        setError(e?.message || "No se pudo cargar tu perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user, onBack, empty]);

  useEffect(() => {
    if (!savedNotice) return;
    const timeoutId = window.setTimeout(() => setSavedNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [savedNotice]);

  const activeAddress = useMemo(() => {
    if (!mapAddressId) return null;
    return form.direcciones.find((address) => address.id === mapAddressId) ?? null;
  }, [form.direcciones, mapAddressId]);

  const canAddMoreAddresses = multiAddressEnabled || form.direcciones.length <= 1;

  return (
    <>
      <motion.section
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-8 pt-16 md:px-6 md:pt-[4.5rem]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-sm md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand/75">
                  Cuenta
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black md:text-3xl">
                  Configuración de tu cuenta
                </h1>
                <p className="mt-1 text-sm text-black/65">
                  Completá tus datos básicos y la dirección principal para pedir más rápido.
                </p>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-black/5 px-4 text-sm font-black text-black hover:bg-black/8"
              >
                Volver a la listita
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-sm md:p-5">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-border bg-white/70 p-4 text-sm text-black/70">
                Cargando perfil...
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="rounded-3xl border border-black/8 bg-[#faf7f7] px-4 py-3">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-black/55">
                    Cuenta actual
                  </div>
                  <div className="mt-1 text-sm font-semibold text-black">
                    {user?.displayName || user?.email || "Cuenta"}
                  </div>
                  <div className="mt-0.5 text-xs text-black/60">{user?.email || ""}</div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {error}
                  </div>
                ) : null}

                {savedNotice ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                    {savedNotice}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-black/8 bg-[#faf7f7] p-4">
                  <div className="mb-3">
                    <div className="text-sm font-black text-black">Datos básicos</div>
                    <div className="mt-1 text-xs font-semibold text-black/55">
                      Estos datos quedan guardados en tu cuenta.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Nombre">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.nombre}
                        onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Tu nombre"
                      />
                    </Field>
                    <Field label="Apellido">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.apellido}
                        onChange={(e) => setForm((prev) => ({ ...prev, apellido: e.target.value }))}
                        placeholder="Tu apellido"
                      />
                    </Field>
                    <Field label="DNI">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.dni}
                        onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
                        placeholder="Documento"
                        inputMode="numeric"
                      />
                    </Field>
                    <Field label="Teléfono">
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                        value={form.telefono}
                        onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
                        placeholder="WhatsApp / celular"
                        inputMode="tel"
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/8 bg-[#faf7f7] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-black">Direcciones</div>
                      <div className="mt-1 text-xs font-semibold text-black/55">
                        Empezamos con una principal. Si querés, después podés sumar más.
                      </div>
                    </div>

                    {!multiAddressEnabled ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMultiAddressEnabled(true);
                          setForm((prev) => {
                            if (prev.direcciones.length > 1) return prev;
                            return {
                              ...prev,
                              direcciones: [
                                ...prev.direcciones,
                                { id: newId(), localidad: "", direccion: "", ubicacion: null },
                              ],
                            };
                          });
                        }}
                        className="h-10 rounded-2xl bg-black/5 px-4 text-xs font-black text-black hover:bg-black/8"
                      >
                        Quiero agregar más de una
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            direcciones: [
                              ...prev.direcciones,
                              { id: newId(), localidad: "", direccion: "", ubicacion: null },
                            ],
                          }))
                        }
                        className="h-10 rounded-2xl bg-[#1f2a8a] px-4 text-xs font-black text-white"
                      >
                        Agregar otra dirección
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {form.direcciones.map((addr, idx) => (
                      <div key={addr.id} className="rounded-3xl border border-border bg-white/88 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-black text-black/70">
                            {idx === 0 ? "Dirección principal" : `Dirección ${idx + 1}`}
                          </div>
                          {multiAddressEnabled && form.direcciones.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  direcciones: prev.direcciones.filter((d) => d.id !== addr.id),
                                }))
                              }
                              className="rounded-xl px-2 py-1 text-xs font-black text-black/60 hover:bg-black/5"
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Field label="Localidad">
                            <input
                              className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                              value={addr.localidad}
                              onChange={(e) => {
                                const value = e.target.value;
                                setForm((prev) => ({
                                  ...prev,
                                  direcciones: prev.direcciones.map((d) =>
                                    d.id === addr.id ? { ...d, localidad: value } : d,
                                  ),
                                }));
                              }}
                              placeholder="Barrio / ciudad"
                            />
                          </Field>

                          <Field label="Dirección">
                            <div className="relative">
                              <input
                                className="h-11 w-full rounded-2xl border border-border bg-white px-4 pr-12 text-[16px] text-black outline-none focus:border-brand/50"
                                value={addr.direccion}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setForm((prev) => ({
                                    ...prev,
                                    direcciones: prev.direcciones.map((d) =>
                                      d.id === addr.id ? { ...d, direccion: value } : d,
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
                                  const query = `${addr.direccion}${addr.localidad ? `, ${addr.localidad}` : ""}`.trim();
                                  setMapInitialQuery(query);
                                }}
                                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl bg-black/5 text-black/70 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/30"
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

                        <div className="mt-2 text-xs font-semibold text-black/70">
                          {addr.ubicacion
                            ? `Ubicación: ${addr.ubicacion.lat.toFixed(5)}, ${addr.ubicacion.lng.toFixed(5)}`
                            : "Sin ubicación marcada"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onBack}
                    className="h-11 rounded-2xl bg-black/5 px-4 text-sm font-black text-black"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving || loading || !baseProfile || !canAddMoreAddresses}
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
                        setSavedNotice("Tus datos quedaron guardados en tu cuenta.");
                      } catch (unknownError) {
                        const e = unknownError as SaveError;
                        setError(e?.message || "No se pudo guardar.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="h-11 rounded-2xl bg-brand px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <MapPickerModal
        open={mapOpen}
        initial={activeAddress?.ubicacion ?? null}
        center={mapCenter}
        initialQuery={mapInitialQuery}
        onClose={() => setMapOpen(false)}
        onPick={(picked) => {
          if (!mapAddressId) return;
          setForm((prev) => ({
            ...prev,
            direcciones: prev.direcciones.map((d) =>
              d.id === mapAddressId ? { ...d, ubicacion: picked } : d,
            ),
          }));
        }}
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
      <path d="M12 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" fill="currentColor" />
    </svg>
  );
}
