"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { GoogleProfileCompletionModal } from "@/components/GoogleProfileCompletionModal";
import { CartPanel } from "@/components/CartPanel";
import { AccountSettingsPage } from "@/components/AccountSettingsPage";
import { DesktopRetailCatalog } from "@/components/store/DesktopRetailCatalog";
import { MobileCatalogPage, type StoreCategory } from "@/components/store/MobileCatalogPage";
import { MotionButton } from "@/components/MotionButton";
import { MyOrdersPage } from "@/components/MyOrdersPage";
import { OffersModal } from "@/components/OffersModal";
import { OptionsModal } from "@/components/OptionsModal";
import { QuantityModal } from "@/components/QuantityModal";
import { StoreShellHeader } from "@/components/store/StoreShellHeader";
import { SuperList, type Selection, type SuperItem } from "@/components/SuperList";
import { useAuth } from "@/auth/AuthProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { normalizeToken } from "@/lib/normalize";
import { getActiveCatalog, getProductById, startCatalogAutoRefresh } from "@/lib/products";
import { APP_VERSION } from "@/lib/appVersion";
import { refreshUserProfile } from "@/lib/userProfile";
import { getDailyOfferUsage } from "@/lib/offerUsage";
import { clearPersistedCart, useCartStore } from "@/store/cart";

type Stage = "landing" | "builder" | "catalog" | "settings" | "orders";
type PendingEntry = "builder" | "settings" | "orders" | null;

type Props = {
  forcedDesktop?: boolean;
  initialStage?: Stage;
};

const DEMO_ACCESS_KEY = "joma_demo_access_v1";

function canonicalizeCategoryToken(value: string) {
  const token = normalizeToken(value);
  if (!token) return "";
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function createItem(
  raw: string,
  opts?: { tokenOverride?: string; source?: SuperItem["source"] },
): SuperItem {
  const token = opts?.tokenOverride ?? normalizeToken(raw);
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    raw,
    token,
    source: opts?.source ?? "list",
    added: false,
    selections: [],
  };
}

function createItemWithOpts(
  raw: string,
  opts?: { noResults?: boolean; token?: string; source?: SuperItem["source"] },
): SuperItem {
  const base = createItem(raw, {
    tokenOverride: opts?.token,
    source: opts?.source,
  });
  if (opts?.noResults) return { ...base, noResults: true };
  return base;
}

export function StoreApp({ forcedDesktop = false, initialStage = "landing" }: Props) {
  const isDesktop = useMediaQuery("(min-width: 1100px)");
  const experience = forcedDesktop || isDesktop ? "desktop" : "mobile";
  const { user, loading: authLoading, signOut } = useAuth();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [returnStage, setReturnStage] = useState<Stage>("landing");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [pendingEntry, setPendingEntry] = useState<PendingEntry>(null);
  const [items, setItems] = useState<SuperItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optionsPulse, setOptionsPulse] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editSelectionId, setEditSelectionId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Awaited<ReturnType<typeof getProductById>>>(null);
  const [floatingCategory, setFloatingCategory] = useState<{ token: string; label: string } | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Awaited<ReturnType<typeof getActiveCatalog>>>([]);
  const [catalogCategoryToken, setCatalogCategoryToken] = useState<string | null>(null);
  const [catalogOffersOnly, setCatalogOffersOnly] = useState(false);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [demoAccess, setDemoAccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      useCartStore.getState().setDailyOfferUsage({});
      return;
    }
    let active = true;
    let lastForegroundSyncAt = 0;
    const syncOfferUsage = (force = false) => {
      if (force) lastForegroundSyncAt = Date.now();
      return void getDailyOfferUsage(user.uid, force).then((usage) => {
      if (active) useCartStore.getState().setDailyOfferUsage(usage);
    }).catch((error) => console.warn("No se pudo consultar el cupo diario de ofertas", error));
    };
    syncOfferUsage(true);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastForegroundSyncAt > 5_000) syncOfferUsage(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [authLoading, user]);
  const [googleProfileIncomplete, setGoogleProfileIncomplete] = useState(false);
  const lastUserUidRef = useRef<string | null>(null);
  const cartItems = useCartStore((state) => state.items);
  const hasBuilderAccess = Boolean(user) || demoAccess;

  const userLabel = useMemo(() => {
    if (!user && demoAccess) return "Modo demo";
    if (!user) return null;
    const name =
      (typeof user.displayName === "string" && user.displayName.trim()) ||
      (typeof user.email === "string" ? user.email.split("@")[0] : "") ||
      "";
    return name || "Cuenta";
  }, [user, demoAccess]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId],
  );

  const resetShoppingSession = () => {
    useCartStore.getState().resetSession();
    clearPersistedCart();
    setItems([]);
    setActiveId(null);
    setShowOptions(false);
    setFloatingCategory(null);
    setShowOffers(false);
  };

  useEffect(() => {
    return startCatalogAutoRefresh();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const catalog = await getActiveCatalog();
      if (cancelled) return;
      setCatalogProducts(catalog);

      const categoryMap = new Map<string, string>();
      for (const product of catalog) {
        const base = String(product.category ?? product.brand ?? "").trim();
        if (!base) continue;
        const token = canonicalizeCategoryToken(base);
        if (!token || categoryMap.has(token)) continue;
        categoryMap.set(token, base);
      }

      const nextCategories = Array.from(categoryMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base" }))
        .map(([token, label]) => ({ token, label }));

      setCategories(nextCategories);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const currentUid = user?.uid || null;
    if (currentUid && lastUserUidRef.current !== currentUid) {
      resetShoppingSession();
    }
    lastUserUidRef.current = currentUid;
  }, [user, authLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDemoAccess(window.localStorage.getItem(DEMO_ACCESS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("store-landing-lock", stage === "landing");
    return () => {
      document.body.classList.remove("store-landing-lock");
    };
  }, [stage]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!pendingEntry) return;
    setAuthOpen(false);
    if (pendingEntry === "builder") setStage("builder");
    if (pendingEntry === "settings") {
      setReturnStage(stage);
      setStage("settings");
    }
    if (pendingEntry === "orders") {
      setReturnStage(stage);
      setStage("orders");
    }
    setPendingEntry(null);
  }, [user, authLoading, pendingEntry, stage]);

  useEffect(() => {
    let cancelled = false;
    if (authLoading || !user || !user.providerData.some((provider) => provider.providerId === "google.com")) {
      setGoogleProfileIncomplete(false);
      return () => { cancelled = true; };
    }
    refreshUserProfile(user.uid).then((profile) => {
      if (!cancelled) setGoogleProfileIncomplete(!profile?.dni);
    });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (stage !== "builder" && stage !== "settings" && stage !== "orders") return;
    if (hasBuilderAccess) return;
    setStage("landing");
  }, [stage, user, authLoading, hasBuilderAccess]);

  useEffect(() => {
    if (stage !== "builder") return;
    if (cartItems.length === 0) {
      setItems((prev) => (prev.length ? [] : prev));
      setActiveId(null);
      setShowOptions(false);
      setFloatingCategory(null);
      return;
    }
    const cartById = new Map(cartItems.map((item) => [item.id, item.qty] as const));
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const selections = item.selections ?? [];
        if (selections.length === 0) return item;
        let localChanged = false;
        const nextSelections: Selection[] = [];
        for (const selection of selections) {
          const qty = cartById.get(selection.id);
          if (!qty) {
            localChanged = true;
            continue;
          }
          if (qty !== selection.qty) localChanged = true;
          nextSelections.push({ ...selection, qty });
        }
        if (!localChanged) return item;
        changed = true;
        return {
          ...item,
          selections: nextSelections,
          added: nextSelections.length > 0,
          noResults: false,
        };
      });
      return changed ? next : prev;
    });
  }, [cartItems, stage]);

  const markAdded = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, added: true, noResults: false } : item,
      ),
    );
  };

  const upsertSelection = (item: SuperItem, selection: Selection): SuperItem => {
    const prev = item.selections ?? [];
    const existing = prev.find((entry) => entry.id === selection.id);
    const nextSelections = existing
      ? prev.map((entry) => (entry.id === selection.id ? { ...entry, qty: entry.qty + selection.qty } : entry))
      : [...prev, selection];
    return {
      ...item,
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
    const selectionId = `${info.productId}:${info.variant}`;
    if (activeItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItem.id
            ? upsertSelection(item, {
                id: selectionId,
                productId: info.productId,
                variant: info.variant,
                qty: info.qty,
              })
            : item,
        ),
      );
      return;
    }

    if (!floatingCategory) return;

    const nextItem = createItem(floatingCategory.label, {
      tokenOverride: floatingCategory.token,
      source: "category",
    });
    setItems((prev) => [
      ...prev,
      upsertSelection(nextItem, {
        id: selectionId,
        productId: info.productId,
        variant: info.variant,
        qty: info.qty,
      }),
    ]);
    setActiveId(nextItem.id);
    setFloatingCategory(null);
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
      const existing = prev.find((item) => item.token === token);
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? upsertSelection(item, {
                id: offerId,
                productId: info.productId,
                variant: info.variant,
                qty: info.qty,
              })
            : item,
        );
      }
      const nextItem: SuperItem = {
        ...createItem("Ofertas", { source: "offer" }),
        offer: true,
      };
      return [
        ...prev,
        upsertSelection(nextItem, {
          id: offerId,
          productId: info.productId,
          variant: info.variant,
          qty: info.qty,
        }),
      ];
    });
  };

  const focusOptions = () => {
    setShowOptions(true);
    setOptionsPulse((value) => value + 1);
  };

  const openCategoryToken = (params: { token: string; label: string }) => {
    const token = normalizeToken(params.token);
    if (!token) return;
    const existing = items.find((item) => item.token === token);
    if (existing) {
      setActiveId(existing.id);
      setFloatingCategory(null);
    } else {
      setActiveId(null);
      setFloatingCategory({ token, label: params.label });
    }
    setShowOptions(true);
    setOptionsPulse((value) => value + 1);
  };

  const goToBuilder = () => {
    if (hasBuilderAccess) {
      setStage("builder");
      return;
    }
    setPendingEntry("builder");
    setAuthMode("login");
    setAuthOpen(true);
  };

  const goToCatalog = () => {
    setCatalogCategoryToken(null);
    setCatalogOffersOnly(false);
    setStage("catalog");
  };

  const goToSettings = () => {
    if (!user) {
      setPendingEntry("settings");
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    setReturnStage(stage);
    setStage("settings");
  };

  const goToOrders = () => {
    if (!user) {
      setPendingEntry("orders");
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    setReturnStage(stage);
    setStage("orders");
  };

  return (
    <div className={`store-root store-root--${experience} ${stage === "landing" ? "store-root--landing" : ""}`}>
      {(stage === "builder" || stage === "catalog") && (stage === "catalog" || hasBuilderAccess) ? (
        <CartPanel
          onOrderCompleted={() => {
            resetShoppingSession();
            setStage("landing");
          }}
        />
      ) : null}

      {stage === "landing" ? (
        <LandingScreen
          userLabel={userLabel}
          onOpenBuilder={goToBuilder}
          onOpenCatalog={goToCatalog}
          onOpenDemo={() => {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(DEMO_ACCESS_KEY, "1");
            }
            setDemoAccess(true);
            setPendingEntry(null);
            setStage("builder");
          }}
          onOpenAuth={() => {
            setPendingEntry(null);
            setAuthMode(user ? "login" : "login");
            setAuthOpen(true);
          }}
          onOpenDesktopDirect={() => {
            if (typeof window === "undefined") return;
            window.location.href = "/desktop";
          }}
        />
      ) : stage === "builder" ? (
        <>
          <StoreShellHeader
            experience={experience}
            active="builder"
            userLabel={userLabel}
            onGoHome={() => setStage("landing")}
            onOpenBuilder={goToBuilder}
            onOpenCatalog={goToCatalog}
            onOpenSettings={goToSettings}
            onOpenOrders={goToOrders}
            onSignOut={async () => {
              resetShoppingSession();
              if (demoAccess && !user) {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(DEMO_ACCESS_KEY);
                }
                setDemoAccess(false);
                setStage("landing");
                return;
              }
              await signOut();
              setStage("landing");
            }}
            onOpenAuth={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          />
          <BuilderShell
            experience={experience}
            version={APP_VERSION}
            items={items}
            activeId={activeId}
            categories={categories}
            onAddItem={(raw, opts) => {
              const nextItem = createItemWithOpts(raw, opts);
              setItems((prev) => [...prev, nextItem]);
              setActiveId(nextItem.id);
              setFloatingCategory(null);
              setShowOptions(false);
            }}
            onSelect={(id) => {
              setActiveId(id);
              setFloatingCategory(null);
            }}
            onMarkAdded={markAdded}
            onClear={() => {
              useCartStore.getState().clear();
              setItems([]);
              setActiveId(null);
              setFloatingCategory(null);
              setShowOptions(false);
            }}
            onFocusOptions={focusOptions}
            onEditSelection={async (itemId, selectionId) => {
              const item = items.find((entry) => entry.id === itemId);
              const selection = item?.selections?.find((entry) => entry.id === selectionId);
              if (!selection) return;
              const product = await getProductById(selection.productId);
              if (!product) return;
              setActiveId(itemId);
              setFloatingCategory(null);
              setEditItemId(itemId);
              setEditSelectionId(selectionId);
              setEditProduct(product);
              setEditOpen(true);
            }}
            onOpenOffers={() => setShowOffers(true)}
            onRemoveItem={(id) => {
              setItems((prev) => {
                const removed = prev.find((entry) => entry.id === id);
                for (const selection of removed?.selections ?? []) {
                  useCartStore.getState().removeItem(selection.id);
                }
                const next = prev.filter((entry) => entry.id !== id);
                setActiveId((current) => (current === id ? next[0]?.id ?? null : current));
                return next;
              });
            }}
            onQuickCategory={(category) => {
              if (category.token === "__offers__") {
                setShowOffers(true);
                return;
              }
              openCategoryToken(category);
            }}
            onOpenCatalog={goToCatalog}
          />
        </>
      ) : stage === "catalog" ? (
        <>
          <StoreShellHeader
            experience={experience}
            active="catalog"
            centerBrand
            userLabel={userLabel}
            onGoHome={() => setStage("landing")}
            onOpenBuilder={goToBuilder}
            onOpenCatalog={goToCatalog}
            onOpenSettings={goToSettings}
            onOpenOrders={goToOrders}
            onSignOut={async () => {
              resetShoppingSession();
              if (demoAccess && !user) {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(DEMO_ACCESS_KEY);
                }
                setDemoAccess(false);
                setStage("landing");
                return;
              }
              await signOut();
              setStage("landing");
            }}
            onOpenAuth={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          />
          {experience === "desktop" ? (
            <DesktopRetailCatalog
              products={catalogProducts}
              categories={categories}
              categoryToken={catalogCategoryToken}
              offersOnly={catalogOffersOnly}
              onCategoryTokenChange={setCatalogCategoryToken}
              onOffersOnlyChange={setCatalogOffersOnly}
            />
          ) : (
            <MobileCatalogPage
              products={catalogProducts}
              categories={categories}
              categoryToken={catalogCategoryToken}
              offersOnly={catalogOffersOnly}
              onCategoryTokenChange={setCatalogCategoryToken}
              onOffersOnlyChange={setCatalogOffersOnly}
            />
          )}
        </>
      ) : stage === "settings" ? (
        <AccountSettingsPage onBack={() => setStage(returnStage)} />
      ) : (
        <MyOrdersPage onBack={() => setStage(returnStage)} />
      )}

      <AuthModal
        open={authOpen}
        mode={authMode}
        onUseDemo={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(DEMO_ACCESS_KEY, "1");
          }
          setDemoAccess(true);
          setPendingEntry(null);
          setStage("builder");
        }}
        onClose={() => {
          setAuthOpen(false);
          setPendingEntry(null);
        }}
        onModeChange={setAuthMode}
      />

      <GoogleProfileCompletionModal
        open={googleProfileIncomplete}
        onComplete={() => setGoogleProfileIncomplete(false)}
      />

      <OffersModal open={showOffers} onClose={() => setShowOffers(false)} onOfferAdded={onAddedFromOffer} />

      <OptionsModal
        open={showOptions}
        activeToken={activeItem?.token ?? floatingCategory?.token ?? null}
        searchMode={floatingCategory || activeItem?.source === "category" ? "category" : "free"}
        pulse={optionsPulse}
        onClose={() => {
          setShowOptions(false);
          if (!activeItem) setFloatingCategory(null);
        }}
        onAdded={onAddedFromSuggestions}
        onSearchState={({ token, hasResults }) => {
          if (!activeItem || activeItem.token !== token) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === activeItem.id
                ? { ...item, noResults: item.added ? false : !hasResults }
                : item,
            ),
          );
        }}
      />

      <QuantityModal
        open={editOpen}
        product={editProduct}
        mode="edit"
        initialVariant={
          editItemId
            ? items.find((item) => item.id === editItemId)?.selections?.find((entry) => entry.id === editSelectionId)?.variant
            : undefined
        }
        initialQty={
          editItemId
            ? items.find((item) => item.id === editItemId)?.selections?.find((entry) => entry.id === editSelectionId)?.qty
            : undefined
        }
        onClose={() => {
          setEditOpen(false);
          setEditSelectionId(null);
        }}
        onDeleteSelection={() => {
          if (!editItemId) return;
          const previous = items.find((item) => item.id === editItemId)?.selections?.find((entry) => entry.id === editSelectionId);
          if (!previous) return;
          const cart = useCartStore.getState();
          cart.removeItem(previous.id);
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== editItemId) return item;
              const nextSelections = (item.selections ?? []).filter((entry) => entry.id !== previous.id);
              return {
                ...item,
                selections: nextSelections,
                added: nextSelections.length > 0,
                noResults: false,
              };
            }),
          );
          setEditOpen(false);
          setEditSelectionId(null);
        }}
        onConfirm={({ product, variant, qty, label, price, unitPriceFinal, unitsPerPack, promoPackQty, promoPackUnitPrice, offerMinQty, offerUnitPrice, offerAllowCoupons, offerMaxUnits }) => {
          if (!editItemId) return;
          const previous = items.find((item) => item.id === editItemId)?.selections?.find((entry) => entry.id === editSelectionId);
          if (!previous) return;

          const oldId = previous.id;
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
                unitPriceFinal,
                unitsPerPack,
                promoPackQty,
                promoPackUnitPrice,
                offerMinQty,
                offerUnitPrice,
                offerAllowCoupons,
                offerMaxUnits,
                stockLimit: product.stockReal,
              },
              qty,
            );
          }

          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== editItemId) return item;
              const withoutOld = (item.selections ?? []).filter((entry) => entry.id !== oldId);
              const existing = withoutOld.find((entry) => entry.id === newId);
              const nextSelections = existing
                ? withoutOld.map((entry) => (entry.id === newId ? { ...entry, qty } : entry))
                : [...withoutOld, { id: newId, productId: product.id, variant, qty }];
              return {
                ...item,
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
    </div>
  );
}

function LandingScreen({
  userLabel,
  onOpenBuilder,
  onOpenCatalog,
  onOpenDemo,
  onOpenAuth,
  onOpenDesktopDirect,
}: {
  userLabel: string | null;
  onOpenBuilder: () => void;
  onOpenCatalog: () => void;
  onOpenDemo: () => void;
  onOpenAuth: () => void;
  onOpenDesktopDirect: () => void;
}) {
  return (
    <main className="store-landing">
      <section className="store-landing__hero">
        <div className="store-landing__masthead">
          <div className="store-landing__brandlock">
            <span>JOMA</span>
            <small>Express</small>
          </div>
          <div className="store-landing__mini-nav">
            <span>Cómo funciona</span>
            <span>Tiendas</span>
            <span>Ofertas</span>
            <span>Empresas</span>
          </div>
        </div>

        <div className="store-landing__split">
          <div className="store-landing__copyzone">
            <div className="store-kicker">Editorial retail</div>
            <h1 className="store-title">Tu súper, a donde estés.</h1>
            <p className="store-copy">
              Miles de productos de calidad, entrega rápida y precios justos. Elegí si querés resolver con una listita o recorrer la tienda completa.
            </p>

            <div className="store-landing__searchline">
              <div className="store-landing__searchfake">Busca productos, marcas o categorías</div>
              <button type="button" className="store-landing__searchcta" aria-label="Buscar">
                ⌕
              </button>
            </div>

            <div className="store-landing__actions">
              <button type="button" className="store-landing-cta store-landing-cta--primary" onClick={onOpenBuilder}>
                Arma tu lista
              </button>
              <button type="button" className="store-landing-cta" onClick={onOpenCatalog}>
                Ver tienda completa
              </button>
            </div>

            <div className="store-landing__benefits">
              <div className="store-landing__benefit">
                <strong>Entrega rápida</strong>
                <span>el mismo día</span>
              </div>
              <div className="store-landing__benefit">
                <strong>Precios justos</strong>
                <span>todos los días</span>
              </div>
              <div className="store-landing__benefit">
                <strong>Calidad garantizada</strong>
                <span>productos frescos</span>
              </div>
            </div>
          </div>

          <div className="store-landing__visual" aria-hidden="true">
            <div className="store-landing__paper" />
            <div className="store-landing__tomato store-landing__tomato--one" />
            <div className="store-landing__tomato store-landing__tomato--two" />
            <div className="store-landing__tomato store-landing__tomato--three" />
            <div className="store-landing__leaf store-landing__leaf--one" />
            <div className="store-landing__leaf store-landing__leaf--two" />
            <div className="store-landing__bottle" />
            <div className="store-landing__labelcard">
              <span>JOMA</span>
              <strong>Tu súper, a donde estés.</strong>
            </div>
          </div>
        </div>
      </section>

      <aside className="store-landing__aside">
        <div className="store-surface store-landing__login">
          <div className="store-section-title">Inicio de sesión</div>
          <p className="store-copy store-copy--small">
            La tienda completa es pública. Tu cuenta sirve para guardar datos, ver pedidos y usar la lista sin repetir pasos.
          </p>
          <MotionButton type="button" className="store-full-btn" onClick={onOpenAuth}>
            {userLabel ? `Continuar como ${userLabel}` : "Entrar o crear cuenta"}
          </MotionButton>
          <MotionButton type="button" tone="ghost" className="store-full-btn" onClick={onOpenDemo}>
            Probar modo demo
          </MotionButton>
        </div>

        <div className="store-surface store-landing__notes">
          <div className="store-section-title">Versión PC independiente</div>
          <p className="store-copy store-copy--small">
            La experiencia de escritorio quedó separada para que sus cambios no toquen el diseño mobile salvo que se pida.
          </p>
          <MotionButton type="button" tone="ghost" className="store-full-btn" onClick={onOpenDesktopDirect}>
            Abrir versión PC
          </MotionButton>
        </div>
      </aside>
    </main>
  );
}

function BuilderShell({
  experience,
  version,
  items,
  activeId,
  categories,
  onAddItem,
  onSelect,
  onMarkAdded,
  onClear,
  onFocusOptions,
  onEditSelection,
  onOpenOffers,
  onRemoveItem,
  onQuickCategory,
  onOpenCatalog,
}: {
  experience: "mobile" | "desktop";
  version: string;
  items: SuperItem[];
  activeId: string | null;
  categories: StoreCategory[];
  onAddItem: (
    raw: string,
    opts?: { noResults?: boolean; token?: string; source?: SuperItem["source"] },
  ) => void;
  onSelect: (id: string) => void;
  onMarkAdded: (id: string) => void;
  onClear: () => void;
  onFocusOptions: () => void;
  onEditSelection: (itemId: string, selectionId: string) => void;
  onOpenOffers: () => void;
  onRemoveItem: (id: string) => void;
  onQuickCategory: (params: { token: string; label: string }) => void;
  onOpenCatalog: () => void;
}) {
  const quickCategories = useMemo(
    () => [
      { token: "__offers__", label: "Ofertas" },
      ...categories.slice(0, experience === "desktop" ? 7 : 5),
    ],
    [categories, experience],
  );

  return (
    <main className={`store-builder store-builder--${experience}`}>
      <section className="store-builder__intro">
        <div className="store-surface store-builder__hero">
          <div className="store-kicker">Arma tu lista</div>
          <h1 className="store-title store-title--compact">
            Primero pensás la compra, después elegís la mejor opción.
          </h1>
          <p className="store-copy">
            El input queda al frente y las sugerencias trabajan para vos. La tienda completa sigue disponible
            cuando necesitás ver todo el catálogo.
          </p>

          <div className="store-chip-row">
            {quickCategories.map((category) => (
              <button
                key={category.token}
                type="button"
                className={`store-chip ${category.token === "__offers__" ? "is-accent" : ""}`}
                onClick={() => onQuickCategory(category)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="store-surface store-builder__side">
          <div className="store-section-title">Cómo usarlo</div>
          <ul className="store-steps">
            <li>Escribí lo que necesitás en lenguaje simple.</li>
            <li>Elegí marca, variante y cantidad desde las sugerencias.</li>
            <li>Usá la tienda completa solo cuando quieras comparar más.</li>
          </ul>
          <MotionButton type="button" tone="ghost" className="store-full-btn" onClick={onOpenCatalog}>
            Ir a tienda completa
          </MotionButton>
          <div className="store-version">Beta {version}</div>
        </div>
      </section>

      <section className="store-builder__workspace">
        <SuperList
          items={items}
          activeId={activeId}
          onAddItem={onAddItem}
          onSelect={onSelect}
          onMarkAdded={onMarkAdded}
          onClear={onClear}
          onFocusOptions={onFocusOptions}
          onEditSelection={onEditSelection}
          onOpenOffers={onOpenOffers}
          onRemoveItem={onRemoveItem}
        />
      </section>
    </main>
  );
}
