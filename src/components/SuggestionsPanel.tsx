"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeToken } from "@/lib/normalize";
import { searchProductsByToken, type Product } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { QuantityModal } from "@/components/QuantityModal";
import { useCartStore } from "@/store/cart";

type Props = {
  activeToken: string | null;
  onAdded: (info: {
    productId: string;
    variant: "unit" | "pack";
    qty: number;
    label: string;
  }) => void;
  onSearchState?: (state: { token: string; hasResults: boolean }) => void;
  pulse?: number;
};

export function SuggestionsPanel({
  activeToken,
  onAdded,
  onSearchState,
  pulse = 0,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onSearchStateRef = useRef<Props["onSearchState"]>(onSearchState);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const token = useMemo(
    () => {
      return activeToken ? normalizeToken(activeToken) : null;
    },
    [activeToken],
  );

  useEffect(() => {
    onSearchStateRef.current = onSearchState;
  }, [onSearchState]);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScrollY = el.scrollHeight - el.clientHeight > 2;
    const canScrollX = el.scrollWidth - el.clientWidth > 2;

    if (canScrollY) {
      setFadeTop(el.scrollTop > 2);
      setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    } else {
      setFadeTop(false);
      setFadeBottom(false);
    }

    if (canScrollX) {
      setFadeLeft(el.scrollLeft > 2);
      setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    } else {
      setFadeLeft(false);
      setFadeRight(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setProducts([]);
        setError(null);
        queueMicrotask(() => updateFades());
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await searchProductsByToken(token);
        if (cancelled) return;
        setProducts(result.products);
        onSearchStateRef.current?.({ token, hasResults: result.products.length > 0 });
        queueMicrotask(() => updateFades());
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error");
        setProducts([]);
        onSearchStateRef.current?.({ token, hasResults: false });
        queueMicrotask(() => updateFades());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    const priceForSort = (p: Product) => {
      const base = p.unit.price;
      const disc = p.offer ? p.offerDiscount ?? 0 : 0;
      if (disc > 0) return Math.max(0, Math.round(base * (1 - disc / 100)));
      return base;
    };
    list.sort((a, b) => {
      const as = a.active === false ? 0 : 1;
      const bs = b.active === false ? 0 : 1;
      if (as !== bs) return bs - as; // in-stock first
      const ap = priceForSort(a);
      const bp = priceForSort(b);
      if (ap !== bp) return ap - bp; // cheaper first
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [products]);

  const visibleProducts = useMemo(() => sortedProducts.slice(0, 4), [sortedProducts]);
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
    // Preload thumbnails for the first items to improve perceived speed.
    const top = sortedProducts.slice(0, 10);
    for (const p of top) {
      const src = String(p.imageUrl ?? "").trim();
      if (!src) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [sortedProducts]);

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
      animate={pulse ? { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 0 4px rgba(225,6,0,0.18)", "0 0 0 rgba(0,0,0,0)"] } : {}}
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
        onConfirm={({ product, variant, qty, label, price }) => {
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
              },
              qty,
            );
          }
          setModalOpen(false);
          onAdded({ productId: product.id, variant, qty, label });
        }}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Opciones</div>
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
            <div className="mt-2 md:hidden">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-semibold text-foreground/70">
                <span aria-hidden="true" className="text-[12px] leading-none">
                  ⇆
                </span>
                Deslizá para ver más
              </div>
            </div>
          ) : null}
        </div>
        <motion.div
          className="hidden md:block"
          initial={false}
          animate={{ opacity: token ? 1 : 0.35 }}
        >
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground/70">
            Elegí un producto
          </div>
        </motion.div>
      </div>

      <div className="mt-3 flex-1 overflow-hidden md:overflow-hidden">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            Buscando productos…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
              Todavía no tenemos opciones para “{token}”.
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="relative">
              {/* Mobile carousel */}
              <div className="md:hidden">
                <div
                  ref={scrollRef}
                  className="no-scrollbar -mr-2 overflow-x-auto overflow-y-hidden pr-2 [scrollbar-gutter:stable] [scrollbar-width:none]"
                  onScroll={updateFades}
                >
                  <div className="flex snap-x snap-mandatory gap-3 pb-2">
                    {sortedProducts.map((p) => (
                      <div key={p.id} className="w-[82%] shrink-0 snap-center">
                        <ProductCard
                          product={p}
                          tag={p.offer ? "OFERTA" : undefined}
                          addedQty={cartById.get(`${p.id}:unit`) ?? cartById.get(`${p.id}:pack`) ?? null}
                          onSelect={() => openProduct(p)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop list (keeps previous limit + vertical scroll) */}
              <motion.div
                ref={scrollRef}
                layout
                className="no-scrollbar hidden max-h-[520px] overflow-auto pr-1 [scrollbar-gutter:stable] md:block"
                onScroll={updateFades}
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
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
