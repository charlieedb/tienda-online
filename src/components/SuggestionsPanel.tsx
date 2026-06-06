"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeToken } from "@/lib/normalize";
import {
  searchProductsByCategoryToken,
  searchProductsByToken,
  type Product,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { QuantityModal } from "@/components/QuantityModal";
import { useCartStore } from "@/store/cart";

type Props = {
  activeToken: string | null;
  searchMode?: "free" | "category";
  onAdded: (info: {
    productId: string;
    variant: "unit" | "pack";
    qty: number;
    label: string;
  }) => void;
  onSearchState?: (state: { token: string; hasResults: boolean }) => void;
  pulse?: number;
};

const INITIAL_VISIBLE_PRODUCTS = 30;
const LOAD_MORE_STEP = 30;

export function SuggestionsPanel({
  activeToken,
  searchMode = "free",
  onAdded,
  onSearchState,
  pulse = 0,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onSearchStateRef = useRef<Props["onSearchState"]>(onSearchState);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);
  const scrollRafRef = useRef<number | null>(null);
  const fadeStateRef = useRef({ top: false, bottom: false, left: false, right: false });
  const loadingMoreRef = useRef(false);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);
  const desktopSentinelRef = useRef<HTMLDivElement | null>(null);

  const token = useMemo(
    () => {
      return activeToken ? normalizeToken(activeToken) : null;
    },
    [activeToken],
  );

  useEffect(() => {
    onSearchStateRef.current = onSearchState;
  }, [onSearchState]);

  const loadMore = () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setVisibleCount((prevCount) => {
      const nextCount = Math.min(prevCount + LOAD_MORE_STEP, sortedProductsRef.current.length);
      loadingMoreRef.current = false;
      return nextCount;
    });
  };

  const updateFades = (el: HTMLDivElement | null) => {
    if (!el) return;
    const canScrollY = el.scrollHeight - el.clientHeight > 2;
    const canScrollX = el.scrollWidth - el.clientWidth > 2;

    let nextTop = false;
    let nextBottom = false;
    let nextLeft = false;
    let nextRight = false;

    if (canScrollY) {
      nextTop = el.scrollTop > 2;
      nextBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    }

    if (canScrollX) {
      nextLeft = el.scrollLeft > 2;
      nextRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    }

    const prev = fadeStateRef.current;
    if (prev.top !== nextTop) setFadeTop(nextTop);
    if (prev.bottom !== nextBottom) setFadeBottom(nextBottom);
    if (prev.left !== nextLeft) setFadeLeft(nextLeft);
    if (prev.right !== nextRight) setFadeRight(nextRight);
    fadeStateRef.current = {
      top: nextTop,
      bottom: nextBottom,
      left: nextLeft,
      right: nextRight,
    };

    const remainingY = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const remainingX = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    const nearBottom = canScrollY && remainingY < 220;
    const nearRight = canScrollX && remainingX < 220;
    if (nearBottom || nearRight) {
      loadMore();
      return;
    }
  };

  const handleScroll = (el: HTMLDivElement | null) => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateFades(el);
    });
  };

  const sortedProductsRef = useRef<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setProducts([]);
        setError(null);
        queueMicrotask(() => {
          updateFades(mobileScrollRef.current);
          updateFades(desktopScrollRef.current);
        });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result =
          searchMode === "category"
            ? await searchProductsByCategoryToken(token)
            : await searchProductsByToken(token);
        if (cancelled) return;
        setProducts(result.products);
        onSearchStateRef.current?.({ token, hasResults: result.products.length > 0 });
        queueMicrotask(() => {
          updateFades(mobileScrollRef.current);
          updateFades(desktopScrollRef.current);
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error");
        setProducts([]);
        onSearchStateRef.current?.({ token, hasResults: false });
        queueMicrotask(() => {
          updateFades(mobileScrollRef.current);
          updateFades(desktopScrollRef.current);
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, searchMode]);

  const addItem = useCartStore((s) => s.addItem);
  const setItemQty = useCartStore((s) => s.setItemQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const cartItems = useCartStore((s) => s.items);
  const cartById = useMemo(
    () => new Map(cartItems.map((c) => [c.id, c.qty] as const)),
    [cartItems],
  );

  const sortedProducts = useMemo(() => {
    const list = [...products];
    list.sort((a, b) => {
      const as = a.active === false ? 0 : 1;
      const bs = b.active === false ? 0 : 1;
      if (as !== bs) return bs - as; // in-stock first
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
    return list;
  }, [products]);

  useEffect(() => {
    sortedProductsRef.current = sortedProducts;
  }, [sortedProducts]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
    loadingMoreRef.current = false;
  }, [token, products.length]);

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, Math.min(visibleCount, sortedProducts.length)),
    [sortedProducts, visibleCount],
  );

  useEffect(() => {
    const root = mobileScrollRef.current;
    const target = mobileSentinelRef.current;
    const hasMoreToUnlock = visibleCount < sortedProducts.length;
    if (!root || !target || !hasMoreToUnlock) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadMore();
      },
      {
        root,
        rootMargin: "200px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, sortedProducts.length, visibleProducts.length]);

  useEffect(() => {
    const root = desktopScrollRef.current;
    const target = desktopSentinelRef.current;
    const hasMoreToUnlock = visibleCount < sortedProducts.length;
    if (!root || !target || !hasMoreToUnlock) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadMore();
      },
      {
        root,
        rootMargin: "200px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, sortedProducts.length, visibleProducts.length]);

  const [selected, setSelected] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"add" | "edit">("add");
  const [selectedInitialVariant, setSelectedInitialVariant] = useState<
    "unit" | "pack" | undefined
  >(undefined);
  const [selectedInitialQty, setSelectedInitialQty] = useState<number | undefined>(
    undefined,
  );
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const openProduct = (p: Product) => {
    const unitId = `${p.id}:unit`;
    const packId = `${p.id}:pack`;
    const unitQty = cartById.get(unitId);
    const packQty = cartById.get(packId);
    const existingId = unitQty ? unitId : packQty ? packId : null;

    setSelectedExistingId(existingId);
    if (existingId) {
      setSelectedMode("edit");
      setSelectedInitialVariant(unitQty ? "unit" : "pack");
      setSelectedInitialQty(unitQty ?? packQty);
    } else {
      setSelectedMode("add");
      setSelectedInitialVariant(undefined);
      setSelectedInitialQty(undefined);
    }
    setSelected(p);
    setModalOpen(true);
  };

  return (
    <motion.div
      className="flex h-full flex-col"
      initial={false}
      animate={pulse ? { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 0 4px rgba(230,57,70,0.18)", "0 0 0 rgba(0,0,0,0)"] } : {}}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <QuantityModal
        open={modalOpen}
        product={selected}
        mode={selectedMode}
        initialVariant={selectedInitialVariant}
        initialQty={selectedInitialQty}
        onClose={() => setModalOpen(false)}
        onDeleteSelection={
          selectedMode === "edit" && selectedExistingId
            ? () => {
                removeItem(selectedExistingId);
                setModalOpen(false);
              }
            : undefined
        }
        onConfirm={({ product, variant, qty, label, price, unitPriceFinal, unitsPerPack }) => {
          const newId = `${product.id}:${variant}`;
          if (selectedMode === "edit" && selectedExistingId) {
            if (selectedExistingId === newId) {
              setItemQty(newId, qty);
            } else {
              removeItem(selectedExistingId);
              addItem(
                {
                  id: newId,
                  productId: product.id,
                  name: `${product.name}${product.brand ? ` · ${product.brand}` : ""}`,
                  variant,
                  label,
                  price,
                  unitPriceFinal,
                  unitsPerPack,
                },
                qty,
              );
            }
          } else {
            addItem(
              {
                id: newId,
                productId: product.id,
                name: `${product.name}${product.brand ? ` · ${product.brand}` : ""}`,
                variant,
                label,
                price,
                unitPriceFinal,
                unitsPerPack,
              },
              qty,
            );
          }
          setModalOpen(false);
          onAdded({ productId: product.id, variant, qty, label });
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="text-xs text-foreground/70">
            {token ? (
              <>
                Para: <span className="font-semibold text-foreground">{token}</span>
              </>
            ) : (
              "Elegí un ítem de la lista."
            )}
          </div>
          {token ? (
            <div className="min-w-0 md:hidden">
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10px] font-semibold text-foreground/70">
                <span aria-hidden="true" className="text-[12px] leading-none">
                  ⇆
                </span>
                Deslizá para ver más
              </div>
            </div>
          ) : null}
        </div>
        <motion.div
          className="hidden shrink-0 md:block"
          initial={false}
          animate={{ opacity: token ? 1 : 0.35 }}
        >
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground/70">
            Elegí un producto
          </div>
        </motion.div>
      </div>

      <div className="mt-2 flex-1 overflow-hidden md:mt-3 md:overflow-hidden">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            Buscando productos...
          </div>
        ) : error ? (
          <div className="app-error rounded-2xl p-4 text-sm">
            {error}
          </div>
        ) : !token ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            Escribí un ítem a la izquierda y seleccionálo para ver opciones.
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            <div className="text-sm font-semibold text-foreground/80">Muy pronto</div>
            <div className="mt-1 text-xs text-foreground/65">
              Todavía no tenemos opciones para "{token}".
            </div>
          </div>
        ) : (
          <div className="relative">
              {/* Mobile carousel */}
              <div className="md:hidden">
                <div
                  ref={mobileScrollRef}
                  className="no-scrollbar -mr-1 overflow-x-auto overflow-y-hidden pr-1 [scrollbar-gutter:stable] [scrollbar-width:none]"
                  onScroll={(e) => handleScroll(e.currentTarget)}
                >
                  <div className="flex snap-x snap-mandatory gap-2 pb-1.5">
                    {visibleProducts.map((p) => (
                      <div key={p.id} className="h-[min(40svh,320px)] w-[72%] shrink-0 snap-center">
                        <ProductCard
                          product={p}
                          tag={p.offer ? "OFERTA" : undefined}
                          addedQty={cartById.get(`${p.id}:unit`) ?? cartById.get(`${p.id}:pack`) ?? null}
                          compact
                          onSelect={() => openProduct(p)}
                        />
                      </div>
                    ))}
                    <div ref={mobileSentinelRef} aria-hidden="true" className="h-px w-px shrink-0" />
                  </div>
                </div>
              </div>

              {/* Desktop list (keeps previous limit + vertical scroll) */}
              <motion.div
                ref={desktopScrollRef}
                layout
                className="no-scrollbar hidden max-h-[520px] overflow-auto pr-1 [scrollbar-gutter:stable] md:block"
                onScroll={(e) => handleScroll(e.currentTarget)}
              >
                <motion.div layout className="flex flex-col gap-1 pb-2">
                  {visibleProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      tag={p.offer ? "OFERTA" : undefined}
                      addedQty={cartById.get(`${p.id}:unit`) ?? cartById.get(`${p.id}:pack`) ?? null}
                      onSelect={() => openProduct(p)}
                    />
                  ))}
                  <div ref={desktopSentinelRef} aria-hidden="true" className="h-px w-full" />
                </motion.div>
              </motion.div>

              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 top-0 h-8"
                initial={false}
                animate={{ opacity: fadeTop ? 1 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  background:
                    "linear-gradient(to bottom, color-mix(in srgb, var(--surface) 92%, transparent), transparent)",
                }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-10"
                initial={false}
                animate={{ opacity: fadeBottom ? 1 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in srgb, var(--surface) 92%, transparent), transparent)",
                }}
              />

              {/* Mobile carousel fades */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 top-0 w-10 md:hidden"
                initial={false}
                animate={{ opacity: fadeLeft ? 1 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  background:
                    "linear-gradient(to right, color-mix(in srgb, var(--surface) 92%, transparent), transparent)",
                }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 top-0 w-10 md:hidden"
                initial={false}
                animate={{ opacity: fadeRight ? 1 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  background:
                    "linear-gradient(to left, color-mix(in srgb, var(--surface) 92%, transparent), transparent)",
                }}
              />
          </div>
        )}
      </div>
    </motion.div>
  );
}


