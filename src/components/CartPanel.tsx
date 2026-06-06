"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-foreground">Carrito</div>
        <MotionButton
          tone="ghost"
          className="h-9 px-3 !text-foreground/80"
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
          <div className="flex flex-col gap-2">
            {items.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border bg-white/82 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{i.name}</div>
                    <div className="text-xs text-foreground/70">
                      {i.label} · {formatArs(i.price)}
                    </div>
                    {typeof i.unitPriceFinal === "number" ? (
                      <div className="mt-1 text-[11px] text-foreground/60">
                        Precio unitario final:{" "}
                        <span className="font-semibold text-foreground/80">{formatArs(i.unitPriceFinal)}</span>
                        {i.variant === "pack" && (i.unitsPerPack || 0) > 1 ? (
                          <span> · {i.unitsPerPack} unid por caja</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <MotionButton
                    tone="ghost"
                    className="h-8 px-2 text-xs !text-foreground/80"
                    onClick={() => removeItem(i.id)}
                  >
                    Quitar
                  </MotionButton>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-foreground/70">
                    Subtotal: <span className="font-semibold text-foreground">{formatArs(i.price * i.qty)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 px-0"
                      onClick={() => decItem(i.id)}
                      aria-label="Restar"
                    >
                      −
                    </MotionButton>
                    <div className="w-8 text-center text-sm font-semibold text-foreground">{i.qty}</div>
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 px-0"
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
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 pb-11 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-foreground/70">Total</div>
          <div className="text-lg font-semibold text-foreground">{formatArs(total)}</div>
        </div>
        <MotionButton className="mt-4 h-11 w-full" disabled={items.length === 0} onClick={onContinue}>
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
            className="fixed left-1/2 top-1/2 z-[130] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border app-modal-surface shadow-2xl"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-border px-5 py-4">
              <div className="text-sm font-semibold text-foreground">Finalizar pedido</div>
              <div className="mt-1 text-xs text-foreground/70">
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
            <div className="flex gap-3 border-t border-border px-5 py-4">
              <MotionButton type="button" tone="ghost" className="h-11 flex-1" onClick={onClose}>
                Cancelar
              </MotionButton>
              <MotionButton type="button" className="h-11 flex-1" onClick={onSubmit} disabled={!canSubmit}>
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

          <motion.div
            className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center text-white"
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.36, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/12 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-md"
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
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Pedido enviado</h2>
              <p className="mt-3 text-sm font-medium text-white/88 sm:text-base">
                Recibimos tu pedido correctamente. En breve lo vamos a preparar.
              </p>
            </div>

            <MotionButton
              type="button"
              className="mt-8 h-12 min-w-40 rounded-2xl border border-white/20 !bg-white !px-8 !text-[#1B5E3A] shadow-[0_16px_34px_rgba(0,0,0,0.14)] hover:!bg-white/95"
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

  const mobileDockBottom = `calc(env(safe-area-inset-bottom, 0px) + ${browserBarInset + 10}px)`;
  const mobileSheetBottom = `calc(env(safe-area-inset-bottom, 0px) + ${browserBarInset + 8}px)`;
  const mobileSheetHeight = `min(78svh, calc(100dvh - env(safe-area-inset-bottom, 0px) - ${browserBarInset + 16}px))`;

  return (
    <>
      <div
        className={[
          "fixed z-40 border border-white/12 bg-[#FF0000] backdrop-blur-md",
          isMobile ? "left-3 right-3 rounded-[28px]" : "bottom-0 left-0 right-0 border-t",
        ].join(" ")}
        style={isMobile ? { bottom: mobileDockBottom } : undefined}
      >
        <div
          className={[
            "relative mx-auto w-full max-w-6xl px-4 pt-8",
            isMobile ? "pb-4" : "pb-[max(env(safe-area-inset-bottom),22px)]",
          ].join(" ")}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            className="absolute left-1/2 top-0 inline-flex min-h-[56px] -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-[22px] bg-white px-6 py-3 text-sm font-black tracking-wide text-[#FF0000] shadow-[0_18px_34px_rgba(255,0,0,0.20)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
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
                className="fixed left-0 right-0 z-[100] overflow-hidden rounded-t-3xl app-sheet-surface pb-[max(env(safe-area-inset-bottom),10px)] shadow-2xl"
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
                className="fixed right-4 top-4 z-[100] h-[calc(100vh-2rem)] w-[380px] overflow-hidden rounded-3xl app-sheet-surface shadow-2xl"
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

