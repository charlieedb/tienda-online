"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { MotionButton } from "@/components/MotionButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { submitCheckoutOrder } from "@/lib/checkoutOrders";
import { formatArs } from "@/lib/format";
import { getActiveCatalog, type Product } from "@/lib/products";
import { getCachedUserProfile, refreshUserProfile } from "@/lib/userProfile";
import { useCartStore } from "@/store/cart";

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M6.5 6h15l-1.5 8.5a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5.7 2.8A1.6 1.6 0 0 0 4.1 1.5H2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
        fill="currentColor"
      />
    </svg>
  );
}

function CartContent({ onContinue }: { onContinue: () => void }) {
  const items = useCartStore((s) => s.items);
  const decItem = useCartStore((s) => s.decItem);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/6 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            Tu pedido
          </div>
          <div className="mt-1 text-sm font-semibold tracking-[-0.02em] text-foreground">Carrito</div>
        </div>
        <MotionButton
          tone="ghost"
          className="h-9 rounded-full border-white/70 bg-white/72 px-3 !text-foreground/80 shadow-none"
          onClick={() => clear()}
          disabled={items.length === 0}
        >
          Vaciar
        </MotionButton>
      </div>

      <div className="no-scrollbar flex-1 overflow-auto p-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/82 p-4 text-sm text-foreground/70">
            Todavía no agregaste nada.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((i) => (
              <div
                key={i.id}
                className="rounded-[24px] border border-white/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,250,0.92))] p-3 shadow-[0_14px_28px_rgba(29,53,87,0.06)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
                    {i.name}
                  </div>
                  <div className="mt-1 text-xs text-foreground/58">
                    {formatArs(typeof i.unitPriceFinal === "number" ? i.unitPriceFinal : i.price)} x unidad
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    {formatArs(i.price)}
                  </div>
                  <div className="rounded-full bg-white/72 p-1 shadow-[0_10px_18px_rgba(29,53,87,0.06)]">
                    <div className="flex items-center gap-1">
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 rounded-full bg-[rgba(232,238,244,0.9)] px-0 shadow-none"
                      onClick={() => decItem(i.id)}
                      aria-label="Restar"
                    >
                      −
                    </MotionButton>
                    <div className="w-9 text-center text-sm font-semibold text-foreground">{i.qty}</div>
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 rounded-full bg-[rgba(232,238,244,0.9)] px-0 shadow-none"
                      onClick={() =>
                        addItem(
                          {
                            id: i.id,
                            productId: i.productId,
                            name: i.name,
                            variant: i.variant,
                            label: i.label,
                            price: i.price,
                            unitPriceFinal: i.unitPriceFinal,
                            unitsPerPack: i.unitsPerPack,
                          },
                          1,
                        )
                      }
                      aria-label="Sumar"
                    >
                      +
                    </MotionButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-black/6 px-4 pb-11 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-foreground/62">Total</div>
          <div className="text-xl font-semibold tracking-[-0.03em] text-foreground">{formatArs(total)}</div>
        </div>
        <MotionButton className="mt-4 h-11 w-full rounded-full" disabled={items.length === 0} onClick={onContinue}>
          Continuar
        </MotionButton>
      </div>
    </div>
  );
}

type CheckoutForm = {
  nombre: string;
  telefono: string;
  direccion: string;
  nota: string;
};

function buildAddress(address: {
  direccion?: string;
  localidad?: string;
  provincia?: string;
} | null) {
  if (!address) return "";
  return [address.direccion, address.localidad, address.provincia]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span aria-hidden="true" className={`app-spinner ${className}`} />;
}

function CheckoutModal({
  open,
  loadingProfile,
  form,
  submitting,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  loadingProfile: boolean;
  form: CheckoutForm;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onChange: (patch: Partial<CheckoutForm>) => void;
  onSubmit: () => void;
}) {
  const canSubmit =
    String(form.nombre || "").trim().length > 0 &&
    String(form.telefono || "").trim().length > 0 &&
    String(form.direccion || "").trim().length > 0 &&
    !submitting;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            aria-label="Cerrar"
            className="modal-backdrop-lite fixed inset-0 z-[120]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-1/2 top-1/2 z-[130] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[32px] border border-white/70 app-modal-surface shadow-[0_34px_80px_rgba(15,23,42,0.22)]"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,249,252,0.82))] px-5 py-4">
              <div className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">Finalizar pedido</div>
              <div className="mt-1 text-xs text-foreground/62">
                Completamos tus datos desde tu perfil y podés corregirlos si hace falta.
              </div>
            </div>
            <div className="space-y-4 px-5 py-4">
              {loadingProfile ? (
                <div className="app-info flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold">
                  <Spinner />
                  <span>Completando tus datos desde tu perfil...</span>
                </div>
              ) : null}
              {error ? (
                <div className="app-error rounded-2xl px-4 py-3 text-xs">
                  {error}
                </div>
              ) : null}

              <label className="block text-xs font-semibold text-foreground/70">
                Nombre
                <input
                  className="app-input mt-1 h-11 w-full rounded-2xl px-4 text-sm"
                  value={form.nombre}
                  onChange={(e) => onChange({ nombre: e.target.value })}
                  placeholder="Tu nombre"
                />
              </label>

              <label className="block text-xs font-semibold text-foreground/70">
                Teléfono
                <input
                  className="app-input mt-1 h-11 w-full rounded-2xl px-4 text-sm"
                  value={form.telefono}
                  onChange={(e) => onChange({ telefono: e.target.value })}
                  placeholder="WhatsApp o teléfono"
                  inputMode="tel"
                />
              </label>

              <label className="block text-xs font-semibold text-foreground/70">
                Dirección
                <input
                  className="app-input mt-1 h-11 w-full rounded-2xl px-4 text-sm"
                  value={form.direccion}
                  onChange={(e) => onChange({ direccion: e.target.value })}
                  placeholder="Dirección de entrega"
                />
              </label>

              <label className="block text-xs font-semibold text-foreground/70">
                Nota
                <input
                  className="app-input mt-1 h-11 w-full rounded-2xl px-4 text-sm"
                  value={form.nota}
                  onChange={(e) => onChange({ nota: e.target.value })}
                  placeholder="Aclaraciones (opcional)"
                />
              </label>
            </div>
            <div className="flex gap-3 border-t border-black/6 px-5 py-4">
              <MotionButton type="button" tone="ghost" className="h-11 flex-1 rounded-full" onClick={onClose}>
                Cancelar
              </MotionButton>
              <MotionButton type="button" className="h-11 flex-1 rounded-full" onClick={onSubmit} disabled={!canSubmit}>
                {submitting ? "Enviando..." : "Enviar pedido"}
              </MotionButton>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function SuccessOverlay({
  open,
  onOk,
}: {
  open: boolean;
  onOk: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[160] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-[#148146]" />
          <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28), transparent 22%), radial-gradient(circle at 80% 18%, rgba(255,255,255,0.18), transparent 20%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.14), transparent 28%)" }} />

          <motion.div
            className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white"
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.36, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-white/18 bg-white/12 shadow-[0_22px_54px_rgba(0,0,0,0.12)] backdrop-blur-md"
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-12 w-12" fill="none">
                <path
                  d="M5 12.5 9.2 16.7 19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>

            <div className="max-w-md">
              <h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Pedido enviado</h2>
              <p className="mt-3 text-sm font-medium text-white/88 sm:text-base">
                Recibimos tu pedido correctamente. En breve lo vamos a preparar.
              </p>
            </div>

            <MotionButton
              type="button"
              className="mt-8 h-12 min-w-40 rounded-full border border-white/16 !bg-white !px-8 !text-[#1B5E3A] shadow-[0_16px_34px_rgba(0,0,0,0.14)] hover:!bg-white/95"
              onClick={onOk}
            >
              OK
            </MotionButton>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function CartPanel({ onOrderCompleted }: { onOrderCompleted?: () => void }) {
  const { user } = useAuth();
  const open = useCartStore((s) => s.open);
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const closeCart = useCartStore((s) => s.closeCart);
  const itemsCount = useMemo(() => items.reduce((a, i) => a + i.qty, 0), [items]);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [form, setForm] = useState<CheckoutForm>({ nombre: "", telefono: "", direccion: "", nota: "" });
  const [browserBarInset, setBrowserBarInset] = useState(0);
  const successAudioContextRef = useRef<AudioContext | null>(null);

  const primeSuccessAudio = async () => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!successAudioContextRef.current) {
      successAudioContextRef.current = new AudioContextCtor();
    }
    if (successAudioContextRef.current.state === "suspended") {
      try {
        await successAudioContextRef.current.resume();
      } catch {
        // Ignore browsers that refuse to resume here.
      }
    }
  };

  const playSuccessSound = async () => {
    try {
      await primeSuccessAudio();
      const ctx = successAudioContextRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.05, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      const partials = [
        { freq: 1318.5, gain: 1, duration: 0.95 },
        { freq: 2637, gain: 0.42, duration: 0.78 },
        { freq: 3951, gain: 0.18, duration: 0.58 },
      ];

      for (const partial of partials) {
        const osc = ctx.createOscillator();
        const partialGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(partial.freq, now);
        partialGain.gain.setValueAtTime(0.0001, now);
        partialGain.gain.exponentialRampToValueAtTime(0.07 * partial.gain, now + 0.01);
        partialGain.gain.exponentialRampToValueAtTime(0.0001, now + partial.duration);
        osc.connect(partialGain);
        partialGain.connect(master);
        osc.start(now);
        osc.stop(now + partial.duration + 0.02);
      }
    } catch {
      // Sound is optional.
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return () => {};

    const viewport = window.visualViewport;
    if (!viewport) return () => {};

    const syncViewportInset = () => {
      const visibleBottom = viewport.height + viewport.offsetTop;
      const hiddenBottom = Math.max(0, window.innerHeight - visibleBottom);
      const active = document.activeElement;
      const editingField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      const keyboardLikelyOpen = hiddenBottom > 160 || (editingField && hiddenBottom > 90);
      setBrowserBarInset(keyboardLikelyOpen ? 0 : Math.round(hiddenBottom));
    };

    syncViewportInset();
    viewport.addEventListener("resize", syncViewportInset);
    viewport.addEventListener("scroll", syncViewportInset);
    window.addEventListener("orientationchange", syncViewportInset);

    return () => {
      viewport.removeEventListener("resize", syncViewportInset);
      viewport.removeEventListener("scroll", syncViewportInset);
      window.removeEventListener("orientationchange", syncViewportInset);
    };
  }, []);

  useEffect(() => {
    if (!successOpen) return;
    const timer = window.setTimeout(() => {
      playSuccessSound();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [successOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!checkoutOpen || !user) return () => {};

    const cached = getCachedUserProfile(user.uid);
    if (cached) {
      const firstAddress = cached.direcciones?.[0] ?? null;
      setForm((prev) => ({
        nombre: prev.nombre || cached.nombre || user.displayName || "",
        telefono: prev.telefono || cached.telefono || "",
        direccion: prev.direccion || buildAddress(firstAddress),
        nota: prev.nota || "",
      }));
    }

    setProfileLoading(true);
    setCheckoutError("");
    refreshUserProfile(user.uid)
      .then((profile) => {
        if (cancelled) return;
        const firstAddress = profile?.direcciones?.[0] ?? null;
        setForm((prev) => ({
          nombre: prev.nombre || profile?.nombre || user.displayName || "",
          telefono: prev.telefono || profile?.telefono || "",
          direccion: prev.direccion || buildAddress(firstAddress),
          nota: prev.nota || "",
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setForm((prev) => ({
          nombre: prev.nombre || user.displayName || "",
          telefono: prev.telefono || "",
          direccion: prev.direccion || "",
          nota: prev.nota || "",
        }));
      })
      .finally(() => {
        if (cancelled) return;
        setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutOpen, user]);

  const handleSubmitOrder = async () => {
    const nombre = String(form.nombre || "").trim();
    const telefono = String(form.telefono || "").trim();
    const direccion = String(form.direccion || "").trim();
    if (!nombre || !telefono || !direccion) {
      setCheckoutError("Completá nombre, teléfono y dirección para enviar el pedido.");
      return;
    }

    setSubmitting(true);
    setCheckoutError("");
    try {
      await primeSuccessAudio();
      const catalog = await getActiveCatalog();
      const productsById = new Map<string, Product>(catalog.map((product) => [product.id, product]));

      await submitCheckoutOrder({
        user,
        customer: {
          nombre,
          telefono,
          direccion,
          nota: String(form.nota || "").trim(),
        },
        cartItems: items,
        productsById,
      });

      clearCart();
      closeCart();
      setCheckoutOpen(false);
      setSuccessOpen(true);
      setForm({ nombre: "", telefono: "", direccion: "", nota: "" });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "No se pudo enviar el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const mobileButtonBottom = `calc(env(safe-area-inset-bottom, 0px) + ${browserBarInset + 14}px)`;
  const mobileSheetBottom = `calc(env(safe-area-inset-bottom, 0px) + ${browserBarInset + 8}px)`;
  const mobileSheetHeight = `min(78svh, calc(100dvh - env(safe-area-inset-bottom, 0px) - ${browserBarInset + 16}px))`;

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        className="fixed left-1/2 z-50 inline-flex min-h-[56px] -translate-x-1/2 items-center gap-3 rounded-[24px] border border-white/74 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,249,250,0.94))] px-6 py-3 text-sm font-black tracking-wide text-[#FF0000] shadow-[0_22px_44px_rgba(29,53,87,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 backdrop-blur-sm"
        style={isMobile ? { bottom: mobileButtonBottom } : { bottom: "18px" }}
        onClick={() => useCartStore.getState().toggleCart()}
        aria-label="Abrir carrito"
      >
        <span className="relative inline-flex">
          <CartIcon />
          {itemsCount > 0 ? (
            <span className="absolute -right-3 -top-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#457B9D] px-1.5 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(29,53,87,0.28)] ring-2 ring-white">
              {itemsCount}
            </span>
          ) : null}
        </span>
        <span>CARRITO</span>
      </motion.button>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/12 bg-[#FF0000]">
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-[max(env(safe-area-inset-bottom),22px)] pt-8">
          <div className="h-7" />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              aria-label="Cerrar carrito"
              className="modal-backdrop-lite fixed inset-0 z-[90]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCart}
            />

            {isMobile ? (
              <motion.aside
                className="fixed left-0 right-0 z-[100] overflow-hidden rounded-t-[32px] app-sheet-surface pb-[max(env(safe-area-inset-bottom),10px)] shadow-[0_-26px_70px_rgba(15,23,42,0.22)]"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
                style={{ bottom: mobileSheetBottom, height: mobileSheetHeight }}
              >
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[rgba(29,53,87,0.18)]" />
                <CartContent onContinue={() => setCheckoutOpen(true)} />
              </motion.aside>
            ) : (
              <motion.aside
                className="fixed right-4 top-4 z-[100] h-[calc(100vh-2rem)] w-[380px] overflow-hidden rounded-[32px] app-sheet-surface shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 30, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
              >
                <CartContent onContinue={() => setCheckoutOpen(true)} />
              </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>

      <CheckoutModal
        open={checkoutOpen}
        loadingProfile={profileLoading}
        form={form}
        submitting={submitting}
        error={checkoutError}
        onClose={() => {
          if (submitting) return;
          setCheckoutOpen(false);
        }}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleSubmitOrder}
      />
      <SuccessOverlay
        open={successOpen}
        onOk={() => {
          setSuccessOpen(false);
          onOrderCompleted?.();
        }}
      />
    </>
  );
}

