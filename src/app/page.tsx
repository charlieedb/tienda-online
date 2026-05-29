"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartPanel } from "@/components/CartPanel";
import { MotionButton } from "@/components/MotionButton";
import { OptionsModal } from "@/components/OptionsModal";
import { SuperList, type SuperItem } from "@/components/SuperList";
import { QuantityModal } from "@/components/QuantityModal";
import { OffersModal } from "@/components/OffersModal";
import { AuthModal } from "@/components/AuthModal";
import { normalizeToken } from "@/lib/normalize";
import { getProductById } from "@/lib/products";
import { useCartStore } from "@/store/cart";
import { useAuth } from "@/auth/AuthProvider";

type Stage = "landing" | "builder";

function ListitaIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 260"
      className="h-[120px] w-auto sm:h-[140px] md:h-[170px]"
    >
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.80)" />
        </linearGradient>
      </defs>

      <rect
        x="18"
        y="18"
        width="240"
        height="220"
        rx="28"
        fill="url(#bg)"
        stroke="rgba(15, 23, 42, 0.12)"
        strokeWidth="2"
      />
      <rect
        x="46"
        y="54"
        width="185"
        height="14"
        rx="7"
        fill="rgba(31, 42, 138, 0.18)"
      />
      <rect
        x="46"
        y="86"
        width="165"
        height="10"
        rx="5"
        fill="rgba(15, 23, 42, 0.10)"
      />
      <rect
        x="46"
        y="110"
        width="175"
        height="10"
        rx="5"
        fill="rgba(15, 23, 42, 0.10)"
      />
      <rect
        x="46"
        y="134"
        width="148"
        height="10"
        rx="5"
        fill="rgba(15, 23, 42, 0.10)"
      />
      <rect
        x="46"
        y="158"
        width="168"
        height="10"
        rx="5"
        fill="rgba(15, 23, 42, 0.10)"
      />
      <rect
        x="46"
        y="182"
        width="138"
        height="10"
        rx="5"
        fill="rgba(15, 23, 42, 0.10)"
      />

      <g transform="translate(220 120) rotate(18)">
        <rect
          x="0"
          y="0"
          width="180"
          height="42"
          rx="20"
          fill="rgba(31, 42, 138, 0.14)"
        />
        <rect x="12" y="11" width="112" height="20" rx="10" fill="#1f2a8a" />
        <rect x="124" y="11" width="22" height="20" rx="10" fill="#2b3bb8" />
        <path
          d="M146 11 L168 21 L146 31 Z"
          fill="rgba(15, 23, 42, 0.80)"
        />
        <path d="M168 21 L176 21" stroke="rgba(15, 23, 42, 0.50)" strokeWidth="3" strokeLinecap="round" />
      </g>

      <circle cx="70" cy="78" r="6" fill="rgba(31, 42, 138, 0.55)" />
      <circle cx="70" cy="102" r="6" fill="rgba(31, 42, 138, 0.55)" />
      <circle cx="70" cy="126" r="6" fill="rgba(31, 42, 138, 0.55)" />
      <circle cx="70" cy="150" r="6" fill="rgba(31, 42, 138, 0.55)" />
      <circle cx="70" cy="174" r="6" fill="rgba(31, 42, 138, 0.55)" />
    </svg>
  );
}

function ListitaIllustrationAlt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 260"
      className="h-[120px] w-auto sm:h-[140px] md:h-[170px]"
    >
      <defs>
        <linearGradient id="paper2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.96)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.82)" />
        </linearGradient>
      </defs>

      {/* Paper */}
      <path
        d="M72 34h170c18 0 32 14 32 32v130c0 18-14 32-32 32H92c-18 0-32-14-32-32V66c0-18 14-32 32-32z"
        fill="url(#paper2)"
        stroke="rgba(0,0,0,0.14)"
        strokeWidth="2"
      />

      {/* Clip */}
      <path
        d="M154 24h52c10 0 18 8 18 18v18c0 10-8 18-18 18h-52c-10 0-18-8-18-18V42c0-10 8-18 18-18z"
        fill="rgba(59,10,22,0.14)"
        stroke="rgba(0,0,0,0.14)"
        strokeWidth="2"
      />
      <path
        d="M165 36h30c6 0 11 5 11 11v10c0 6-5 11-11 11h-30c-6 0-11-5-11-11V47c0-6 5-11 11-11z"
        fill="rgba(225,6,0,0.85)"
      />

      {/* Lines */}
      <g opacity="0.8" fill="rgba(0,0,0,0.12)">
        <rect x="92" y="92" width="150" height="10" rx="5" />
        <rect x="92" y="118" width="166" height="10" rx="5" />
        <rect x="92" y="144" width="138" height="10" rx="5" />
        <rect x="92" y="170" width="158" height="10" rx="5" />
      </g>

      {/* Pencil */}
      <g transform="translate(252 130) rotate(22)">
        <rect x="0" y="0" width="150" height="26" rx="13" fill="rgba(0,0,0,0.10)" />
        <rect x="10" y="5" width="98" height="16" rx="8" fill="#E10600" />
        <rect x="108" y="5" width="22" height="16" rx="8" fill="#3B0A16" />
        <path d="M130 5 L148 13 L130 21 Z" fill="rgba(0,0,0,0.78)" />
      </g>
    </svg>
  );
}

function createItem(raw: string): SuperItem {
  const token = normalizeToken(raw);
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    raw,
    token,
    added: false,
  };
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [stage, setStage] = useState<Stage>("landing");
  const [items, setItems] = useState<SuperItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optionsPulse, setOptionsPulse] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Awaited<ReturnType<typeof getProductById>>>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const cartItems = useCartStore((s) => s.items);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // If the user is authenticated, skip landing and go straight to the builder.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    setAuthOpen(false);
    setStage("builder");
  }, [authLoading, user]);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );

  const markAdded = (
    id: string,
    purchased?: { productId: string; variant: "unit" | "pack"; qty: number },
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, added: true, noResults: false, purchased } : i,
      ),
    );
  };

  const onAddedFromSuggestions = (info: {
    productId: string;
    variant: "unit" | "pack";
    qty: number;
    label: string;
  }) => {
    if (!activeItem) return;
    markAdded(activeItem.id, {
      productId: info.productId,
      variant: info.variant,
      qty: info.qty,
    });
    const next = items.find((i) => !i.added && i.id !== activeItem.id);
    if (next) setActiveId(next.id);
  };

  const onAddedFromOffer = (info: {
    productId: string;
    name: string;
    variant: "unit" | "pack";
    qty: number;
  }) => {
    const token = normalizeToken(info.name);
    if (!token) return;
    setItems((prev) => {
      // Offers always create their own list row (separate from what the user typed).
      // If the same offer-product was added before, just accumulate qty on that offer row.
      const existingOffer = prev.find(
        (i) =>
          i.offer &&
          i.purchased?.productId === info.productId &&
          i.purchased?.variant === info.variant,
      );
      if (existingOffer) {
        return prev.map((i) =>
          i.id === existingOffer.id
            ? {
                ...i,
                raw: info.name,
                token,
                offer: true,
                added: true,
                noResults: false,
                purchased: {
                  productId: info.productId,
                  variant: info.variant,
                  qty: (i.purchased?.qty ?? 0) + info.qty,
                },
              }
            : i,
        );
      }
      const it: SuperItem = {
        ...createItem(info.name),
        offer: true,
        added: true,
        noResults: false,
        purchased: { productId: info.productId, variant: info.variant, qty: info.qty },
      };
      return [it, ...prev];
    });
  };

  const focusOptions = () => {
    setShowOptions(true);
    setOptionsPulse((p) => p + 1);
  };

  useEffect(() => {
    if (stage !== "builder") return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (!t) return;
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;
      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      // "Back" swipe: start near left edge, swipe right, mostly horizontal.
      if (start.x <= 24 && dx >= 80 && Math.abs(dy) <= 40) {
        setStage("landing");
        setShowOptions(false);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [stage]);

  // Gate builder behind auth.
  // (Visitors must log in to access anything; the locked screen below enforces it.)
  useEffect(() => {
    if (stage !== "builder") return;
    if (authLoading) return;
    if (user) return;
    setStage("landing");
  }, [stage, user, authLoading]);

  // Keep list selection in sync with cart (remove selection if removed from cart, update qty if changed).
  useEffect(() => {
    if (stage !== "builder") return;
    const cartById = new Map(cartItems.map((c) => [c.id, c.qty] as const));
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        if (!it.purchased) return it;
        const key = `${it.purchased.productId}:${it.purchased.variant}`;
        const qty = cartById.get(key);
        if (!qty) {
          changed = true;
          return {
            ...it,
            added: false,
            purchased: undefined,
            offer: false,
            noResults: false,
          };
        }
        if (qty !== it.purchased.qty) {
          changed = true;
          return { ...it, purchased: { ...it.purchased, qty } };
        }
        return it;
      });
      return changed ? next : prev;
    });
  }, [cartItems, stage]);

  const setItemPurchased = (id: string, purchased: SuperItem["purchased"]) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, purchased } : i)));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-5">
        <div className="text-sm font-semibold text-foreground/70">Cargando…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-5 pb-10 pt-10">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-surface/60 p-5 text-center backdrop-blur-sm">
            <div className="text-base font-semibold text-foreground">Iniciá sesión para continuar</div>
            <div className="mt-1 text-sm text-foreground/70">
              Necesitás una cuenta para usar la tienda.
            </div>
          </div>
        </div>

        <AuthModal
          open
          forced
          mode={authMode}
          onClose={() => {}}
          onModeChange={setAuthMode}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {stage === "builder" && user ? <CartPanel /> : null}

      <AnimatePresence mode="wait" initial={false}>
        {stage === "landing" ? (
          <motion.main
            key="landing"
            className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-10 pt-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
                <span className="font-black italic tracking-tight text-foreground">
                  JONICO
                </span>
                <span className="text-foreground/65">el super de la esquina</span>
              </div>
              <h1 className="text-pretty text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Hacelo simple: escribí lo que necesitás, y elegí la mejor opción.
              </h1>
              <p className="max-w-2xl text-pretty text-base leading-7 text-foreground/70 md:text-lg">
                Armá tu lista en segundos y elegí productos por cada ítem.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-3 md:gap-4">
                <motion.button
                  type="button"
                  onClick={() => {
                    if (authLoading) return;
                    if (user) {
                      setStage("builder");
                      return;
                    }
                    setAuthMode("login");
                    setAuthOpen(true);
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 600, damping: 35 }}
                  className={[
                    "group w-full rounded-3xl px-4 py-4",
                    "outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                    "transition-transform hover:-translate-y-0.5 active:translate-y-0",
                    authLoading ? "opacity-70" : "",
                  ].join(" ")}
                  aria-label="Arma tu lista"
                >
                  <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
                    <div className="shrink-0 drop-shadow-[0_10px_18px_rgba(15,23,42,0.10)]">
                      <ListitaIllustrationAlt />
                    </div>

                    <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                      <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-5">
                        <div className="text-center font-hand text-[32px] leading-none text-foreground sm:text-left sm:text-[40px]">
                          Arma tu listita,
                          <br />
                          con un click
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.button>

                <div className="flex w-full max-w-3xl items-center justify-center gap-3">
                  <MotionButton
                    tone="ghost"
                    className="h-10 px-4 !text-foreground/80 hover:!bg-foreground/5"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthOpen(true);
                    }}
                    disabled={authLoading}
                  >
                    Iniciar sesión
                  </MotionButton>
                  <MotionButton
                    tone="soft"
                    className="h-10 px-4"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthOpen(true);
                    }}
                    disabled={authLoading}
                  >
                    Crear cuenta
                  </MotionButton>
                </div>

                <div className="text-xs text-foreground/60">
                  Si no configurás Firebase todavía, las sugerencias usan placeholder.
                </div>
              </div>
            </div>

            <footer className="mt-auto pt-10 text-center text-sm font-semibold text-foreground/80">
              <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3 rounded-3xl border border-border bg-surface/55 px-4 py-3 backdrop-blur-sm">
                <Image
                  src="/jonico-logo.png"
                  alt="Jonico"
                  width={30}
                  height={30}
                  className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.10)]"
                />
                <div className="text-left leading-tight">
                  <div className="text-sm font-black italic tracking-tight text-foreground">
                    JONICO
                  </div>
                  <div className="text-xs font-medium text-foreground/60">
                    el Super de la Esquina · Envios gratis
                  </div>
                </div>
              </div>
            </footer>

            <AuthModal
              open={authOpen}
              mode={authMode}
              onClose={() => setAuthOpen(false)}
              onModeChange={setAuthMode}
            />
          </motion.main>
        ) : (
          <motion.main
            key="builder"
            className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-5 md:gap-6 md:px-6 md:py-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <QuantityModal
              open={editOpen}
              product={editProduct}
              mode="edit"
              initialVariant={
                editItemId
                  ? items.find((i) => i.id === editItemId)?.purchased?.variant
                  : undefined
              }
              initialQty={
                editItemId
                  ? items.find((i) => i.id === editItemId)?.purchased?.qty
                  : undefined
              }
              onClose={() => setEditOpen(false)}
              onDeleteSelection={() => {
                if (!editItemId) return;
                const prev = items.find((i) => i.id === editItemId)?.purchased;
                if (!prev) return;
                const cart = useCartStore.getState();
                cart.removeItem(`${prev.productId}:${prev.variant}`);
                setItems((p) =>
                  p.map((i) =>
                    i.id === editItemId
                      ? { ...i, added: false, purchased: undefined, offer: false, noResults: false }
                      : i,
                  ),
                );
                setEditOpen(false);
              }}
              onConfirm={({ product, variant, qty, label, price }) => {
                if (!editItemId) return;
                const prev = items.find((i) => i.id === editItemId)?.purchased;
                if (!prev) return;

                const oldId = `${prev.productId}:${prev.variant}`;
                const newId = `${product.id}:${variant}`;
                const cart = useCartStore.getState();
                if (oldId === newId) {
                  cart.setItemQty(oldId, qty);
                } else {
                  cart.removeItem(oldId);
                  cart.addItem(
                    {
                      id: newId,
                      productId: product.id,
                      name: `${product.name}${product.brand ? ` · ${product.brand}` : ""}`,
                      variant,
                      label,
                      price,
                    },
                    qty,
                  );
                }

                setItemPurchased(editItemId, { productId: product.id, variant, qty });
                setEditOpen(false);
              }}
            />

            <OffersModal
              open={showOffers}
              onClose={() => setShowOffers(false)}
              onOfferAdded={onAddedFromOffer}
            />

            <OptionsModal
              open={showOptions}
              activeToken={activeItem?.token ?? null}
              pulse={optionsPulse}
              onClose={() => setShowOptions(false)}
              onAdded={(info) => {
                onAddedFromSuggestions(info);
                setShowOptions(false);
              }}
              onSearchState={({ token, hasResults }) => {
                if (!activeItem || activeItem.token !== token) return;
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === activeItem.id
                      ? { ...i, noResults: i.added ? false : !hasResults }
                      : i,
                  ),
                );
              }}
            />

            <div className="flex items-center justify-start">
              <MotionButton
                tone="ghost"
                className="h-10 px-3"
                onClick={() => {
                  setStage("landing");
                  setShowOptions(false);
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Inicio
              </MotionButton>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 md:gap-6">
              <div className="min-h-[40vh] rounded-3xl border border-border bg-surface p-4 shadow-sm md:min-h-0">
                <SuperList
                  items={items}
                  activeId={activeId}
                  onAddItem={(raw) => {
                    const it = createItem(raw);
                    setItems((prev) => [it, ...prev]);
                    setActiveId(it.id);
                    setShowOptions(false);
                  }}
                  onSelect={(id) => setActiveId(id)}
                  onMarkAdded={(id) => markAdded(id)}
                  onClear={() => {
                    setItems([]);
                    setActiveId(null);
                    setShowOptions(false);
                  }}
                  onFocusOptions={focusOptions}
                  onEditPurchased={async (id) => {
                    const it = items.find((i) => i.id === id);
                    if (!it?.purchased) return;
                    const p = await getProductById(it.purchased.productId);
                    if (!p) return;
                    setActiveId(id);
                    setEditItemId(id);
                    setEditProduct(p);
                    setEditOpen(true);
                  }}
                  onOpenOffers={() => setShowOffers(true)}
                  onRemoveItem={(id) => {
                    setItems((prev) => {
                      const removed = prev.find((i) => i.id === id);
                      if (removed?.purchased) {
                        useCartStore
                          .getState()
                          .removeItem(
                            `${removed.purchased.productId}:${removed.purchased.variant}`,
                          );
                      }
                      const next = prev.filter((i) => i.id !== id);
                      setActiveId((a) => (a === id ? next[0]?.id ?? null : a));
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
