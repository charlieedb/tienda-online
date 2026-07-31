"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { formatArs } from "@/lib/format";
import { normalizeToken } from "@/lib/normalize";
import type { Product } from "@/lib/products";
import { useCartStore } from "@/store/cart";
import type { StoreCategory } from "@/components/store/MobileCatalogPage";

type Props = {
  products: Product[];
  categories: StoreCategory[];
  categoryToken: string | null;
  offersOnly: boolean;
  onCategoryTokenChange: (token: string | null) => void;
  onOffersOnlyChange: (value: boolean) => void;
};

const PAGE_SIZE = 18;

type PendingState = {
  activeVariant: "unit" | "pack";
  qtyByVariant: { unit: number; pack: number };
};

function buildCartItem(product: Product, variant: "unit" | "pack") {
  const packQty = Math.max(1, product.pack?.qty ?? 1);
  const label =
    variant === "pack"
      ? product.pack?.label ?? `Caja x${packQty}`
      : product.unit.label || "Unidad";
  const price = variant === "pack" ? product.pack?.price ?? product.unit.price : product.unit.price;
  const unitPriceFinal = variant === "pack" ? price / packQty : price;

  return {
    id: `${product.id}:${variant}`,
    productId: product.id,
    name: `${product.name}${product.brand ? ` · ${product.brand}` : ""}`,
    variant,
    label,
    price,
    unitPriceFinal,
    unitsPerPack: variant === "pack" ? packQty : 1,
  };
}

export function DesktopRetailCatalog({
  products,
  categories,
  categoryToken,
  offersOnly,
  onCategoryTokenChange,
  onOffersOnlyChange,
}: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const cartItems = useCartStore((state) => state.items);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [variantByProduct, setVariantByProduct] = useState<Record<string, "unit" | "pack">>({});
  const [pendingByProduct, setPendingByProduct] = useState<Record<string, PendingState>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const normalizedSearch = normalizeToken(deferredSearch);

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      if (offersOnly && !product.offer) return false;
      if (categoryToken) {
        const token = normalizeToken(product.category || product.brand || "");
        if (token !== categoryToken) return false;
      }
      if (!normalizedSearch) return true;
      const haystack = normalizeToken(
        [product.name, product.id, product.brand, product.category, ...(product.keywords || [])]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(normalizedSearch);
    });
  }, [activeProducts, categoryToken, normalizedSearch, offersOnly]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPendingByProduct({});
  }, [categoryToken, offersOnly, normalizedSearch]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= filteredProducts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredProducts.length));
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredProducts.length, visibleCount]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const featuredProducts = visibleProducts.slice(0, 2);
  const gridProducts = visibleProducts.slice(2);

  const productsInCart = useMemo(() => {
    const map = new Map<string, { unit: number; pack: number }>();
    for (const item of cartItems) {
      const current = map.get(item.productId) ?? { unit: 0, pack: 0 };
      current[item.variant] += item.qty;
      map.set(item.productId, current);
    }
    return map;
  }, [cartItems]);

  const totalItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalAmount = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <section className="store-catalog store-catalog--desktop">
      <div className="store-desktop-hero">
        <div className="store-surface store-desktop-hero__copy">
          <div className="store-kicker">Tienda Online</div>
          <h1 className="store-title">
            Comprá rápido, con precios grandes y opciones claras.
          </h1>
        </div>

        <div className="store-surface store-desktop-hero__stats">
          <Metric label="Productos visibles" value={String(filteredProducts.length)} />
          <Metric label="Ítems en carrito" value={String(totalItems)} />
          <Metric label="Total estimado" value={formatArs(totalAmount)} />
        </div>
      </div>

      <div className="store-catalog__toolbar store-catalog__toolbar--wide">
        <label className="store-field store-field--hero">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar productos, marcas o categorías"
            className="store-input store-input--hero"
          />
        </label>
      </div>

      <div className="store-desktop-layout">
        <aside className="store-desktop-sidebar">
          <div className="store-surface">
            <div className="store-section-title">Filtrar rápido</div>
            <div className="store-desktop-sidebar__group">
              <SidebarFilter
                active={!categoryToken && !offersOnly}
                onClick={() => {
                  onCategoryTokenChange(null);
                  onOffersOnlyChange(false);
                }}
              >
                Todo el catálogo
              </SidebarFilter>
              <SidebarFilter
                active={offersOnly}
                onClick={() => {
                  onCategoryTokenChange(null);
                  onOffersOnlyChange(true);
                }}
              >
                Solo ofertas
              </SidebarFilter>
              {categories.map((category) => (
                <SidebarFilter
                  key={category.token}
                  active={!offersOnly && categoryToken === category.token}
                  onClick={() => {
                    onCategoryTokenChange(category.token);
                    onOffersOnlyChange(false);
                  }}
                >
                  {category.label}
                </SidebarFilter>
              ))}
            </div>
          </div>

          <div className="store-surface store-desktop-sidebar__cart">
            <div className="store-section-title">Carrito actual</div>
            <strong>{formatArs(totalAmount)}</strong>
            <span>{totalItems} ítems cargados</span>
            <MotionButton type="button" className="store-full-btn" onClick={openCart}>
              Revisar carrito
            </MotionButton>
          </div>
        </aside>

        <div className="store-desktop-main">
          {filteredProducts.length === 0 ? (
            <div className="store-empty">
              No encontramos productos con esos filtros. Probá volver al catálogo general.
            </div>
          ) : (
            <>
              <div className="store-feature-grid">
                {featuredProducts.map((product) => (
                  <DesktopProductCard
                    key={product.id}
                    product={product}
                    compact={false}
                    cartState={productsInCart.get(product.id) ?? { unit: 0, pack: 0 }}
                    selectedVariant={
                      variantByProduct[product.id] === "pack" && product.pack ? "pack" : "unit"
                    }
                    pending={pendingByProduct[product.id] ?? null}
                    onVariantChange={(variant) =>
                      setVariantByProduct((prev) => ({
                        ...prev,
                        [product.id]: variant,
                      }))
                    }
                    onPendingChange={(next) =>
                      setPendingByProduct((prev) => ({
                        ...prev,
                        [product.id]: next,
                      }))
                    }
                    onConfirm={(variant, qty) => {
                      addItem(buildCartItem(product, variant), qty);
                      setPendingByProduct((prev) => {
                        const next = { ...prev };
                        delete next[product.id];
                        return next;
                      });
                    }}
                    onCancel={() =>
                      setPendingByProduct((prev) => {
                        const next = { ...prev };
                        delete next[product.id];
                        return next;
                      })
                    }
                  />
                ))}
              </div>

              <div className="store-product-grid">
                {gridProducts.map((product) => (
                  <DesktopProductCard
                    key={product.id}
                    product={product}
                    compact
                    cartState={productsInCart.get(product.id) ?? { unit: 0, pack: 0 }}
                    selectedVariant={
                      variantByProduct[product.id] === "pack" && product.pack ? "pack" : "unit"
                    }
                    pending={pendingByProduct[product.id] ?? null}
                    onVariantChange={(variant) =>
                      setVariantByProduct((prev) => ({
                        ...prev,
                        [product.id]: variant,
                      }))
                    }
                    onPendingChange={(next) =>
                      setPendingByProduct((prev) => ({
                        ...prev,
                        [product.id]: next,
                      }))
                    }
                    onConfirm={(variant, qty) => {
                      addItem(buildCartItem(product, variant), qty);
                      setPendingByProduct((prev) => {
                        const next = { ...prev };
                        delete next[product.id];
                        return next;
                      });
                    }}
                    onCancel={() =>
                      setPendingByProduct((prev) => {
                        const next = { ...prev };
                        delete next[product.id];
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="store-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SidebarFilter({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`store-sidebar-filter ${active ? "is-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function DesktopProductCard({
  product,
  compact,
  cartState,
  selectedVariant,
  pending,
  onVariantChange,
  onPendingChange,
  onConfirm,
  onCancel,
}: {
  product: Product;
  compact: boolean;
  cartState: { unit: number; pack: number };
  selectedVariant: "unit" | "pack";
  pending: PendingState | null;
  onVariantChange: (variant: "unit" | "pack") => void;
  onPendingChange: (pending: PendingState) => void;
  onConfirm: (variant: "unit" | "pack", qty: number) => void;
  onCancel: () => void;
}) {
  const activePendingQty = pending ? pending.qtyByVariant[pending.activeVariant] : 1;
  const selectedPrice =
    selectedVariant === "pack" && product.pack ? product.pack.price : product.unit.price;

  return (
    <article className={`store-surface store-desktop-card ${compact ? "is-compact" : ""}`}>
      <div className="store-product-card__topline">
        <div className="store-product-card__meta">
          <span>{product.category || "Catálogo"}</span>
          <span>{product.brand || "Selección JOMA"}</span>
        </div>
        <div className="store-product-card__totals">
          {product.offer ? <small className="store-badge store-badge--inline">Oferta</small> : null}
          {cartState.unit ? <small>{cartState.unit} U</small> : null}
          {cartState.pack ? <small>{cartState.pack} C</small> : null}
        </div>
      </div>

      <h2 className="store-product-card__title">{product.name}</h2>

      <div className="store-product-card__priceband">
        <div>
          <span className="store-label">Precio activo</span>
          <strong>{formatArs(selectedPrice)}</strong>
        </div>
      </div>

      <div className="store-variant-toggle">
        <button
          type="button"
          className={`store-variant-toggle__option ${selectedVariant === "unit" ? "is-active" : ""}`}
          onClick={() => onVariantChange("unit")}
          aria-pressed={selectedVariant === "unit"}
        >
          <span>Unidad</span>
          <strong>{formatArs(product.unit.price)}</strong>
        </button>
        {product.pack ? (
          <button
            type="button"
            className={`store-variant-toggle__option ${selectedVariant === "pack" ? "is-active" : ""}`}
            onClick={() => onVariantChange("pack")}
            aria-pressed={selectedVariant === "pack"}
          >
            <span>{product.pack.label}</span>
            <strong>{formatArs(product.pack.price)}</strong>
          </button>
        ) : null}
      </div>

      {!pending ? (
        <MotionButton
          type="button"
          className="store-full-btn"
          onClick={() =>
            onPendingChange({
              activeVariant: selectedVariant,
              qtyByVariant: { unit: 1, pack: 1 },
            })
          }
        >
          Agregar
        </MotionButton>
      ) : (
        <div className="store-inline-qty">
          <div className="store-inline-qty__stepper">
            <button
              type="button"
              onClick={() =>
                onPendingChange({
                  ...pending,
                  qtyByVariant: {
                    ...pending.qtyByVariant,
                    [pending.activeVariant]: Math.max(1, activePendingQty - 1),
                  },
                })
              }
            >
              −
            </button>
            <input
              value={activePendingQty}
              onChange={(event) =>
                onPendingChange({
                  ...pending,
                  qtyByVariant: {
                    ...pending.qtyByVariant,
                    [pending.activeVariant]: Math.max(
                      1,
                      Math.min(999, Math.trunc(Number(event.target.value || 1))),
                    ),
                  },
                })
              }
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() =>
                onPendingChange({
                  ...pending,
                  qtyByVariant: {
                    ...pending.qtyByVariant,
                    [pending.activeVariant]: Math.min(999, activePendingQty + 1),
                  },
                })
              }
            >
              +
            </button>
          </div>

          <div className="store-inline-qty__actions">
            <button type="button" className="store-inline-qty__cancel" onClick={onCancel}>
              Cancelar
            </button>
            <MotionButton type="button" className="store-inline-qty__confirm" onClick={() => onConfirm(pending.activeVariant, activePendingQty)}>
              Confirmar
            </MotionButton>
          </div>
        </div>
      )}
    </article>
  );
}
