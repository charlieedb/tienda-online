"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartPanel } from "@/components/CartPanel";
import { MotionButton } from "@/components/MotionButton";
import { OptionsModal } from "@/components/OptionsModal";
import { SuperList, type Selection, type SuperItem } from "@/components/SuperList";
import { QuantityModal } from "@/components/QuantityModal";
import { OffersModal } from "@/components/OffersModal";
import { AuthModal } from "@/components/AuthModal";
import { normalizeToken } from "@/lib/normalize";
import { getProductById, startCatalogAutoRefresh } from "@/lib/products";
import { useCartStore } from "@/store/cart";
import { useAuth } from "@/auth/AuthProvider";
import { APP_VERSION } from "@/lib/appVersion";

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
    selections: [],
  };
}

function createItemWithOpts(raw: string, opts?: { noResults?: boolean }): SuperItem {
  const base = createItem(raw);
  if (opts?.noResults) return { ...base, noResults: true };
  return base;
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [stage, setStage] = useState<Stage>("landing");
  const [items, setItems] = useState<SuperItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optionsPulse, setOptionsPulse] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editSelectionId, setEditSelectionId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Awaited<ReturnType<typeof getProductById>>>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const cartItems = useCartStore((s) => s.items);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    return startCatalogAutoRefresh();
  }, []);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );

  const markAdded = (
    id: string,
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, added: true, noResults: false } : i,
      ),
    );
  };

  const upsertSelection = (it: SuperItem, sel: Selection): SuperItem => {
    const prev = it.selections ?? [];
    const existing = prev.find((s) => s.id === sel.id);
    const nextSelections = existing
      ? prev.map((s) => (s.id === sel.id ? { ...s, qty: s.qty + sel.qty } : s))
      : [...prev, sel];
    return {
      ...it,
      added: nextSelections.length > 0,
      noResults: false,
      selections: nextSelections,
    };
  };

  const onAddedFromSuggestions = (info: {
    productId: string;
    variant: "unit" | "pack";
    qty: number;
    label: string;
  }) => {
    if (!activeItem) return;
    const id = `${info.productId}:${info.variant}`;
    setItems((prev) =>
      prev.map((it) =>
        it.id === activeItem.id
          ? upsertSelection(it, {
              id,
              productId: info.productId,
              variant: info.variant,
              qty: info.qty,
            })
          : it,
      ),
    );
  };

  const onAddedFromOffer = (info: {
    productId: string;
    name: string;
    variant: "unit" | "pack";
    qty: number;
  }) => {
    const token = normalizeToken("Ofertas");
    if (!token) return;
    setItems((prev) => {
      const offerId = `${info.productId}:${info.variant}`;
      const existing = prev.find((i) => i.token === token);
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id
            ? upsertSelection(i, {
                id: offerId,
                productId: info.productId,
                variant: info.variant,
                qty: info.qty,
              })
            : i,
        );
      }

      const it: SuperItem = {
        ...createItem("Ofertas"),
        offer: true,
      };
      return [upsertSelection(it, { id: offerId, productId: info.productId, variant: info.variant, qty: info.qty }), ...prev];
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
    if (cartItems.length === 0) {
      // If the cart is emptied, clear the list too (user expects both to stay in sync).
      setItems((prev) => (prev.length ? [] : prev));
      setActiveId(null);
      setShowOptions(false);
      return;
    }
    const cartById = new Map(cartItems.map((c) => [c.id, c.qty] as const));
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        const selections = it.selections ?? [];
        if (selections.length === 0) return it;
        let localChanged = false;
        const nextSelections: Selection[] = [];
        for (const s of selections) {
          const qty = cartById.get(s.id);
          if (!qty) {
            localChanged = true;
            continue;
          }
          if (qty !== s.qty) localChanged = true;
          nextSelections.push({ ...s, qty });
        }
        if (!localChanged) return it;
        changed = true;
        return {
          ...it,
          selections: nextSelections,
          added: nextSelections.length > 0,
          noResults: false,
        };
      });
      return changed ? next : prev;
    });
  }, [cartItems, stage]);

  return (
    <div className="min-h-dvh bg-background">
      {stage === "builder" && user ? <CartPanel /> : null}

      <AnimatePresence mode="wait" initial={false}>
        {stage === "landing" ? (
          <motion.main
            key="landing"
            className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-10 pt-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.35] motion-safe:animate-[fondo-pan_26s_linear_infinite]"
              style={{
                backgroundImage: "url(/fondo.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "360px auto",
                backgroundPosition: "center top",
              }}
            />

            <div className="relative z-10 flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
                <span className="font-black italic tracking-tight text-foreground">
                  JONICO
                </span>
                <span className="text-foreground/65">el super de la esquina</span>
              </div>
              <h1 className="text-pretty text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Hacelo simple: escribí lo que necesitás, y elegí la mejor opción.
              </h1>
            </div>

            <div className="relative z-10 mt-6 flex items-center justify-center">
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
                        <div className="flex items-center justify-center sm:justify-start">
                          <img
                            src="/arma.png"
                            alt="Arma tu listita"
                            className="h-auto w-[min(340px,100%)] select-none object-contain sm:w-[380px]"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.button>

                <div className="flex w-full max-w-3xl items-center justify-center gap-3">
                  {user ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
                      <div className="min-w-0 text-center text-sm text-foreground/70 sm:text-left">
                        <div className="truncate font-semibold text-foreground">
                          {user.displayName || user.email || "Cuenta"}
                        </div>
                        <div className="truncate text-xs text-foreground/60">
                          {user.email || ""}
                        </div>
                      </div>
                      <MotionButton
                        tone="ghost"
                        className="h-10 w-full px-4 !text-foreground/80 hover:!bg-foreground/5 sm:w-auto"
                        onClick={async () => {
                          await signOut();
                          setStage("landing");
                        }}
                        disabled={authLoading}
                      >
                        Cerrar sesión
                      </MotionButton>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                <div className="text-xs text-foreground/60">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-semibold text-foreground/70">
                    Versión Beta {APP_VERSION}
                  </span>
                </div>
              </div>
            </div>

            <footer className="relative z-10 mt-auto pt-10 text-center text-sm font-semibold text-foreground/80">
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
                  ? items
                      .find((i) => i.id === editItemId)
                      ?.selections?.find((s) => s.id === editSelectionId)
                      ?.variant
                  : undefined
              }
              initialQty={
                editItemId
                  ? items
                      .find((i) => i.id === editItemId)
                      ?.selections?.find((s) => s.id === editSelectionId)
                      ?.qty
                  : undefined
              }
              onClose={() => {
                setEditOpen(false);
                setEditSelectionId(null);
              }}
              onDeleteSelection={() => {
                if (!editItemId) return;
                const prev = items
                  .find((i) => i.id === editItemId)
                  ?.selections?.find((s) => s.id === editSelectionId);
                if (!prev) return;
                const cart = useCartStore.getState();
                cart.removeItem(prev.id);
                setItems((p) =>
                  p.map((i) => {
                    if (i.id !== editItemId) return i;
                    const nextSelections = (i.selections ?? []).filter(
                      (s) => s.id !== prev.id,
                    );
                    return {
                      ...i,
                      selections: nextSelections,
                      added: nextSelections.length > 0,
                      noResults: false,
                    };
                  }),
                );
                setEditOpen(false);
                setEditSelectionId(null);
              }}
              onConfirm={({ product, variant, qty, label, price }) => {
                if (!editItemId) return;
                const prev = items
                  .find((i) => i.id === editItemId)
                  ?.selections?.find((s) => s.id === editSelectionId);
                if (!prev) return;

                const oldId = prev.id;
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

                setItems((p) =>
                  p.map((i) => {
                    if (i.id !== editItemId) return i;
                    const withoutOld = (i.selections ?? []).filter((s) => s.id !== oldId);
                    const existing = withoutOld.find((s) => s.id === newId);
                    const nextSelections = existing
                      ? withoutOld.map((s) => (s.id === newId ? { ...s, qty } : s))
                      : [...withoutOld, { id: newId, productId: product.id, variant, qty }];
                    return {
                      ...i,
                      selections: nextSelections,
                      added: nextSelections.length > 0,
                      noResults: false,
                    };
                  }),
                );
                setEditOpen(false);
                setEditSelectionId(null);
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
              <div className="flex min-h-[40vh] flex-col rounded-3xl border border-border bg-surface p-4 shadow-sm md:min-h-0">
                <SuperList
                  items={items}
                  activeId={activeId}
                  onAddItem={(raw, opts) => {
                    const it = createItemWithOpts(raw, opts);
                    setItems((prev) => [it, ...prev]);
                    setActiveId(it.id);
                    setShowOptions(false);
                  }}
                  onSelect={(id) => setActiveId(id)}
                  onMarkAdded={(id) => markAdded(id)}
                  onClear={() => {
                    useCartStore.getState().clear();
                    setItems([]);
                    setActiveId(null);
                    setShowOptions(false);
                  }}
                  onFocusOptions={focusOptions}
                  onEditSelection={async (itemId, selectionId) => {
                    const it = items.find((i) => i.id === itemId);
                    const sel = it?.selections?.find((s) => s.id === selectionId);
                    if (!sel) return;
                    const p = await getProductById(sel.productId);
                    if (!p) return;
                    setActiveId(itemId);
                    setEditItemId(itemId);
                    setEditSelectionId(selectionId);
                    setEditProduct(p);
                    setEditOpen(true);
                  }}
                  onOpenOffers={() => setShowOffers(true)}
                  onRemoveItem={(id) => {
                    setItems((prev) => {
                      const removed = prev.find((i) => i.id === id);
                      for (const s of removed?.selections ?? []) {
                        useCartStore.getState().removeItem(s.id);
                      }
                      const next = prev.filter((i) => i.id !== id);
                      setActiveId((a) => (a === id ? next[0]?.id ?? null : a));
                      return next;
                    });
                  }}
                />

                <div className="mt-2">
                  <motion.button
                    type="button"
                    onClick={() => setShowOffers(true)}
                    whileTap={{ scale: 0.99 }}
                    className="w-full rounded-2xl border border-black/10 bg-[#F4B61E] px-4 py-3 text-center text-sm font-black tracking-tight text-black shadow-[0_10px_18px_rgba(0,0,0,0.10)] hover:brightness-[0.98] active:brightness-[0.96]"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <span aria-hidden="true" className="text-[14px] leading-none">
                        ✦
                      </span>
                      <span>Ofertas del Dia!</span>
                      <span aria-hidden="true" className="text-[14px] leading-none">
                        ✦
                      </span>
                    </span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
