"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { formatArs } from "@/lib/format";
import { normalizeToken } from "@/lib/normalize";
import type { Product } from "@/lib/products";
import { getCartPricingMap, useCartStore } from "@/store/cart";
import type { Category } from "@/components/TopBar";

type Props = {
  products: Product[];
  categories: Category[];
  categoryToken: string | null;
  offersOnly: boolean;
  onCategoryTokenChange: (token: string | null) => void;
  onOffersOnlyChange: (value: boolean) => void;
  onOpenBuilder: () => void;
};

const PAGE_SIZE = 20;

function buildCartItem(product: Product, variant: "unit" | "pack") {
  const packQty = Math.max(1, product.pack?.qty ?? 1);
  const label =
    variant === "pack"
      ? product.pack?.label ?? `caja x${packQty}`
      : product.unit.label || "unidad";
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
    promoPackQty: product.pack?.qty,
    promoPackUnitPrice: product.packPromoUnitPrice,
  };
}

function ProductArtwork({ product }: { product: Product }) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="desktop-shop-card__placeholder">
      <span>{product.name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export function DesktopCatalogPage({
  products,
  categories,
  categoryToken,
  offersOnly,
  onCategoryTokenChange,
  onOffersOnlyChange,
  onOpenBuilder,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const cartItems = useCartStore((s) => s.items);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [variantByProduct, setVariantByProduct] = useState<Record<string, "unit" | "pack">>({});
  const [pendingByProduct, setPendingByProduct] = useState<
    Record<
      string,
      {
        activeVariant: "unit" | "pack";
        qtyByVariant: { unit: number; pack: number };
      }
    >
  >({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products],
  );

  const priceBounds = useMemo(() => {
    if (activeProducts.length === 0) return { min: 0, max: 0 };
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const product of activeProducts) {
      const price = Math.max(0, product.sortPrice || product.unit.price || 0);
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
    if (!Number.isFinite(min)) min = 0;
    return { min, max };
  }, [activeProducts]);

  useEffect(() => {
    setPriceRange(priceBounds);
  }, [priceBounds.min, priceBounds.max]);

  const normalizedSearch = normalizeToken(deferredSearch);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      if (offersOnly && !product.offer) return false;
      if (categoryToken) {
        const token = normalizeToken(product.category || product.brand || "");
        if (token !== categoryToken) return false;
      }

      const price = Math.max(0, product.sortPrice || product.unit.price || 0);
      if (price < priceRange.min || price > priceRange.max) return false;

      if (!normalizedSearch) return true;

      const haystack = normalizeToken(
        [product.name, product.id, product.brand, product.category, ...(product.keywords || [])]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(normalizedSearch);
    });
  }, [activeProducts, categoryToken, normalizedSearch, offersOnly, priceRange.max, priceRange.min]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [categoryToken, offersOnly, normalizedSearch, priceRange.min, priceRange.max]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= filteredProducts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredProducts.length));
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredProducts.length, visibleCount]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const featuredProducts = visibleProducts.slice(0, 3);
  const shelfProducts = visibleProducts.slice(3);
  const totalCartItems = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const cartPricing = getCartPricingMap(cartItems);
  const cartTotal = cartItems.reduce((acc, item) => acc + cartPricing.get(item.id)!.total, 0);
  const categoriesForSidebar = categories.filter((category) => category.token !== "__offers__");

  const productsInCart = useMemo(() => {
    const map = new Map<string, { unit: number; pack: number }>();
    for (const item of cartItems) {
      const current = map.get(item.productId) ?? { unit: 0, pack: 0 };
      current[item.variant] += item.qty;
      map.set(item.productId, current);
    }
    return map;
  }, [cartItems]);

  const getSelectedVariant = (product: Product): "unit" | "pack" => {
    const selected = variantByProduct[product.id];
    if (selected === "pack" && product.pack) return "pack";
    return "unit";
  };

  const updatePendingQty = (productId: string, qty: number) => {
    setPendingByProduct((prev) => {
      const current = prev[productId];
      if (!current) return prev;
      const activeVariant = current.activeVariant;
      return {
        ...prev,
        [productId]: {
          ...current,
          qtyByVariant: {
            ...current.qtyByVariant,
            [activeVariant]: Math.max(0, Math.min(999, Math.trunc(qty || 0))),
          },
        },
      };
    });
  };

  const activeCategoryLabel = categoryToken
    ? categories.find((category) => category.token === categoryToken)?.label ?? "Personalizada"
    : "Todo el catálogo";

  return (
    <section className="desktop-shop-shell relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-8 pt-20 md:px-4 md:pt-24">
      <div className="desktop-shop-hero">
        <div className="desktop-shop-hero__copy">
          <div className="desktop-shop-panel__eyebrow">Tienda escritorio</div>
          <h1 className="desktop-shop-hero__title">
            Un mostrador digital para comprar como en una cadena grande.
          </h1>
          <p className="desktop-shop-hero__copy-text">
            Buscá por nombre, filtrá por línea o precio y sumá variantes sin perder el foco.
            El escritorio queda como una estación de compra completa, rápida y cómoda.
          </p>

          <div className="desktop-shop-hero__actions">
            <MotionButton tone="primary" className="desktop-shop-hero__action" onClick={onOpenBuilder}>
              Volver al armado
            </MotionButton>
            <MotionButton tone="ghost" className="desktop-shop-hero__action" onClick={openCart}>
              Abrir carrito
            </MotionButton>
          </div>
        </div>

        <div className="desktop-shop-hero__stats">
          <div className="desktop-shop-hero__stat">
            <span>Productos visibles</span>
            <strong>{filteredProducts.length}</strong>
          </div>
          <div className="desktop-shop-hero__stat">
            <span>En pantalla</span>
            <strong>{visibleProducts.length}</strong>
          </div>
          <div className="desktop-shop-hero__stat">
            <span>Carrito actual</span>
            <strong>{totalCartItems}</strong>
          </div>
          <div className="desktop-shop-hero__stat desktop-shop-hero__stat--wide">
            <span>Total estimado</span>
            <strong>{formatArs(cartTotal)}</strong>
          </div>
        </div>
      </div>

      <div className="desktop-shop-layout">
        <aside className="desktop-shop-sidebar">
          <div className="desktop-shop-panel desktop-shop-sidebar__panel">
            <div className="desktop-shop-panel__eyebrow">Centro de control</div>
            <h2 className="desktop-shop-sidebar__title">Filtrado rápido</h2>
            <p className="desktop-shop-sidebar__copy">
              Entrás por categoría, acotás por precio y volvés a la lista sin perder contexto.
            </p>

            <MotionButton
              tone="ghost"
              className="desktop-shop-sidebar__builder-btn"
              onClick={onOpenBuilder}
            >
              Abrir listita
            </MotionButton>
          </div>

          <div className="desktop-shop-panel">
            <div className="desktop-shop-panel__title">Vista activa</div>
            <div className="desktop-shop-sidebar__summary">
              <div>
                <span>Categoría</span>
                <strong>{activeCategoryLabel}</strong>
              </div>
              <div>
                <span>Ofertas</span>
                <strong>{offersOnly ? "Solo ofertas" : "Todas"}</strong>
              </div>
              <div>
                <span>Precio</span>
                <strong>
                  {formatArs(priceRange.min)} - {formatArs(priceRange.max)}
                </strong>
              </div>
            </div>
          </div>

          <div className="desktop-shop-panel">
            <div className="desktop-shop-panel__title">Líneas rápidas</div>
            <div className="desktop-shop-filter-list">
              <button
                type="button"
                className={`desktop-shop-filter-chip ${!categoryToken && !offersOnly ? "is-active" : ""}`}
                onClick={() => {
                  onCategoryTokenChange(null);
                  onOffersOnlyChange(false);
                }}
              >
                Todo el catálogo
              </button>
              <button
                type="button"
                className={`desktop-shop-filter-chip ${offersOnly ? "is-active" : ""}`}
                onClick={() => {
                  onCategoryTokenChange(null);
                  onOffersOnlyChange(true);
                }}
              >
                Solo ofertas
              </button>
              {categoriesForSidebar.map((category) => (
                <button
                  key={category.token}
                  type="button"
                  className={`desktop-shop-filter-chip ${categoryToken === category.token && !offersOnly ? "is-active" : ""}`}
                  onClick={() => {
                    onCategoryTokenChange(category.token);
                    onOffersOnlyChange(false);
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="desktop-shop-panel">
            <div className="desktop-shop-panel__title">Filtrar por precio</div>
            <div className="desktop-shop-price-grid">
              <label className="desktop-shop-input-wrap">
                <span>Desde</span>
                <input
                  type="number"
                  min={priceBounds.min}
                  max={priceRange.max || priceBounds.max}
                  value={priceRange.min}
                  onChange={(event) => {
                    const next = Number(event.target.value || 0);
                    setPriceRange((prev) => ({
                      min: Math.max(priceBounds.min, Math.min(next, prev.max)),
                      max: prev.max,
                    }));
                  }}
                  className="desktop-shop-input"
                />
              </label>
              <label className="desktop-shop-input-wrap">
                <span>Hasta</span>
                <input
                  type="number"
                  min={priceRange.min || priceBounds.min}
                  max={priceBounds.max}
                  value={priceRange.max}
                  onChange={(event) => {
                    const next = Number(event.target.value || 0);
                    setPriceRange((prev) => ({
                      min: prev.min,
                      max: Math.max(prev.min, Math.min(next, priceBounds.max)),
                    }));
                  }}
                  className="desktop-shop-input"
                />
              </label>
            </div>
            <button
              type="button"
              className="desktop-shop-reset"
              onClick={() => setPriceRange(priceBounds)}
            >
              Resetear precio
            </button>
          </div>

          <div className="desktop-shop-panel desktop-shop-cart-card">
            <div className="desktop-shop-panel__title">Carrito actual</div>
            <div className="desktop-shop-cart-metric">
              <span>{totalCartItems}</span>
              <small>artículos</small>
            </div>
            <div className="desktop-shop-cart-total">{formatArs(cartTotal)}</div>
            <MotionButton className="h-11 w-full rounded-2xl" onClick={openCart}>
              Abrir carrito
            </MotionButton>
          </div>
        </aside>

        <div className="desktop-shop-main">
          <div className="desktop-shop-panel desktop-shop-toolbar">
            <div>
              <div className="desktop-shop-panel__eyebrow">Catálogo completo</div>
              <h2 className="desktop-shop-toolbar__title">Elegí directo desde la tienda</h2>
              <p className="desktop-shop-toolbar__copy">
                La búsqueda y los filtros conviven arriba del listado para que el recorrido sea
                corto y visual.
              </p>
            </div>
            <label className="desktop-shop-search">
              <span>Buscar producto</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, código o línea"
                className="desktop-shop-input"
              />
            </label>
          </div>

          <div className="desktop-shop-results desktop-shop-panel">
            <div>
              <strong>{filteredProducts.length}</strong> productos encontrados
            </div>
            <div>
              Viendo <strong>{visibleProducts.length}</strong> de {filteredProducts.length}
            </div>
            <div>
              {categoryToken ? (
                <>
                  Foco en{" "}
                  <strong>
                    {categories.find((category) => category.token === categoryToken)?.label ?? categoryToken}
                  </strong>
                </>
              ) : (
                <>
                  Vista <strong>general</strong>
                </>
              )}
            </div>
          </div>

          {featuredProducts.length ? (
            <div className="desktop-shop-feature-strip">
              {featuredProducts.map((product) => {
                const selectedVariant = getSelectedVariant(product);
                const pending = pendingByProduct[product.id] ?? null;
                const pendingUnitQty = pending?.qtyByVariant.unit ?? 0;
                const pendingPackQty = pending?.qtyByVariant.pack ?? 0;
                const activePendingQty = pending ? pending.qtyByVariant[pending.activeVariant] : 0;
                const isPack = selectedVariant === "pack" && Boolean(product.pack);
                const selectedPrice = isPack && product.pack ? product.pack.price : product.unit.price;
                const cartState = productsInCart.get(product.id) ?? { unit: 0, pack: 0 };

                return (
                  <article key={product.id} className="desktop-shop-feature">
                    <div className="desktop-shop-feature__media">
                      <ProductArtwork product={product} />
                      {product.offer ? <span className="desktop-shop-card__badge">Oferta</span> : null}
                    </div>

                    <div className="desktop-shop-feature__body">
                      <div className="desktop-shop-card__meta">
                        <span>{product.category || "Catálogo"}</span>
                        <span>{product.brand || "Marca propia"}</span>
                      </div>
                      <h3 className="desktop-shop-feature__title">{product.name}</h3>
                      <p className="desktop-shop-card__copy">
                        {product.pack?.label ? product.pack.label : "Unidad disponible"}
                        {selectedPrice ? ` · ${formatArs(selectedPrice)}` : ""}
                      </p>

                      <div className="desktop-shop-feature__row">
                        <div className="desktop-shop-feature__price">
                          <span>Precio activo</span>
                          <strong>{formatArs(selectedPrice)}</strong>
                        </div>
                        <div className="desktop-shop-card__cartpill">
                          {cartState.unit ? <span>{cartState.unit} U</span> : null}
                          {product.pack && cartState.pack ? <span>{cartState.pack} C</span> : null}
                        </div>
                      </div>

                      <div className="desktop-shop-variant-picker">
                        <button
                          type="button"
                          className={`desktop-shop-variant-option ${selectedVariant === "unit" ? "is-active" : ""}`}
                          onClick={() => {
                            setVariantByProduct((prev) => ({ ...prev, [product.id]: "unit" }));
                            setPendingByProduct((prev) =>
                              prev[product.id]
                                ? {
                                    ...prev,
                                    [product.id]: {
                                      ...prev[product.id],
                                      activeVariant: "unit",
                                    },
                                  }
                                : prev,
                            );
                          }}
                        >
                          {pending ? <span className="desktop-shop-variant-pill">{pendingUnitQty}</span> : null}
                          <small>Unidad</small>
                          <strong>{formatArs(product.unit.price)}</strong>
                        </button>

                        {product.pack ? (
                          <button
                            type="button"
                            className={`desktop-shop-variant-option ${selectedVariant === "pack" ? "is-active" : ""}`}
                            onClick={() => {
                              setVariantByProduct((prev) => ({ ...prev, [product.id]: "pack" }));
                              setPendingByProduct((prev) =>
                                prev[product.id]
                                  ? {
                                      ...prev,
                                      [product.id]: {
                                        ...prev[product.id],
                                        activeVariant: "pack",
                                      },
                                    }
                                  : prev,
                              );
                            }}
                          >
                            {pending ? <span className="desktop-shop-variant-pill">{pendingPackQty}</span> : null}
                            <small>{product.pack.label}</small>
                            <strong>{formatArs(product.pack.price)}</strong>
                          </button>
                        ) : null}
                      </div>

                      <div className="desktop-shop-card__actions">
                        {!pending ? (
                          <button
                            type="button"
                            className="desktop-shop-addcta"
                            onClick={() =>
                              setPendingByProduct((prev) => ({
                                ...prev,
                                [product.id]: {
                                  activeVariant: selectedVariant,
                                  qtyByVariant: { unit: 0, pack: 0 },
                                },
                              }))
                            }
                          >
                            <span>Agregar</span>
                          </button>
                        ) : (
                          <div className="desktop-shop-qtyconfirm">
                            <div className="desktop-shop-qtybox">
                              <button
                                type="button"
                                className="desktop-shop-qtybtn"
                                onClick={() => updatePendingQty(product.id, activePendingQty - 1)}
                                aria-label="Restar cantidad"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={activePendingQty}
                                onChange={(event) =>
                                  updatePendingQty(product.id, Number(event.target.value || 0))
                                }
                                className="desktop-shop-qtyinput"
                                aria-label="Cantidad"
                              />
                              <button
                                type="button"
                                className="desktop-shop-qtybtn"
                                onClick={() => updatePendingQty(product.id, activePendingQty + 1)}
                                aria-label="Sumar cantidad"
                              >
                                +
                              </button>
                            </div>

                            <div className="desktop-shop-qtyconfirm-actions">
                              <button
                                type="button"
                                className="desktop-shop-cancel"
                                onClick={() =>
                                  setPendingByProduct((prev) => {
                                    const next = { ...prev };
                                    delete next[product.id];
                                    return next;
                                  })
                                }
                                aria-label="Cancelar selección"
                                title="Cancelar"
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                                  <path
                                    d="M6 6l12 12M18 6L6 18"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>

                              <button
                                type="button"
                                className="desktop-shop-confirm"
                                disabled={activePendingQty <= 0}
                                onClick={() => {
                                  if (activePendingQty <= 0) return;
                                  addItem(buildCartItem(product, pending.activeVariant), activePendingQty);
                                  setPendingByProduct((prev) => {
                                    const next = { ...prev };
                                    delete next[product.id];
                                    return next;
                                  });
                                }}
                                aria-label="Confirmar cantidad"
                                title="Confirmar"
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                                  <path
                                    d="M5 12.5l4.2 4.2L19 7"
                                    stroke="currentColor"
                                    strokeWidth="2.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="desktop-shop-list">
            {shelfProducts.map((product) => {
              const selectedVariant = getSelectedVariant(product);
              const pending = pendingByProduct[product.id] ?? null;
              const pendingUnitQty = pending?.qtyByVariant.unit ?? 0;
              const pendingPackQty = pending?.qtyByVariant.pack ?? 0;
              const activePendingQty = pending ? pending.qtyByVariant[pending.activeVariant] : 0;
              const isPack = selectedVariant === "pack" && Boolean(product.pack);
              const selectedPrice = isPack && product.pack ? product.pack.price : product.unit.price;
              const cartState = productsInCart.get(product.id) ?? { unit: 0, pack: 0 };

              return (
                <article key={product.id} className="desktop-shop-row">
                  <div className="desktop-shop-row__media">
                    <ProductArtwork product={product} />
                    {product.offer ? <span className="desktop-shop-card__badge">Oferta</span> : null}
                    <div className="desktop-shop-card__cartpill">
                      {cartState.unit ? <span>{cartState.unit} U</span> : null}
                      {product.pack && cartState.pack ? <span>{cartState.pack} C</span> : null}
                    </div>
                  </div>

                  <div className="desktop-shop-row__body">
                    <div className="desktop-shop-card__meta">
                      <span>{product.category || "Catálogo"}</span>
                      <span>{product.brand || "Marca propia"}</span>
                    </div>

                    <div>
                      <h3 className="desktop-shop-row__title">{product.name}</h3>
                      <p className="desktop-shop-card__copy">
                        {product.pack?.label ? product.pack.label : "Unidad disponible"}
                        {selectedPrice ? ` · ${formatArs(selectedPrice)}` : ""}
                      </p>
                    </div>

                    <div className="desktop-shop-variant-picker">
                      <button
                        type="button"
                        className={`desktop-shop-variant-option ${selectedVariant === "unit" ? "is-active" : ""}`}
                        onClick={() => {
                          setVariantByProduct((prev) => ({ ...prev, [product.id]: "unit" }));
                          setPendingByProduct((prev) =>
                            prev[product.id]
                              ? {
                                  ...prev,
                                  [product.id]: {
                                    ...prev[product.id],
                                    activeVariant: "unit",
                                  },
                                }
                              : prev,
                          );
                        }}
                      >
                        {pending ? <span className="desktop-shop-variant-pill">{pendingUnitQty}</span> : null}
                        <small>Unidad</small>
                        <strong>{formatArs(product.unit.price)}</strong>
                      </button>

                      {product.pack ? (
                        <button
                          type="button"
                          className={`desktop-shop-variant-option ${selectedVariant === "pack" ? "is-active" : ""}`}
                          onClick={() => {
                            setVariantByProduct((prev) => ({ ...prev, [product.id]: "pack" }));
                            setPendingByProduct((prev) =>
                              prev[product.id]
                                ? {
                                    ...prev,
                                    [product.id]: {
                                      ...prev[product.id],
                                      activeVariant: "pack",
                                    },
                                  }
                                : prev,
                            );
                          }}
                        >
                          {pending ? <span className="desktop-shop-variant-pill">{pendingPackQty}</span> : null}
                          <small>{product.pack.label}</small>
                          <strong>{formatArs(product.pack.price)}</strong>
                        </button>
                      ) : null}
                    </div>

                    <div className="desktop-shop-row__actions">
                      {!pending ? (
                        <button
                          type="button"
                          className="desktop-shop-addcta"
                          onClick={() =>
                            setPendingByProduct((prev) => ({
                              ...prev,
                              [product.id]: {
                                activeVariant: selectedVariant,
                                qtyByVariant: { unit: 0, pack: 0 },
                              },
                            }))
                          }
                        >
                          <span>Agregar</span>
                        </button>
                      ) : (
                        <div className="desktop-shop-qtyconfirm">
                          <div className="desktop-shop-qtybox">
                            <button
                              type="button"
                              className="desktop-shop-qtybtn"
                              onClick={() => updatePendingQty(product.id, activePendingQty - 1)}
                              aria-label="Restar cantidad"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={activePendingQty}
                              onChange={(event) =>
                                updatePendingQty(product.id, Number(event.target.value || 0))
                              }
                              className="desktop-shop-qtyinput"
                              aria-label="Cantidad"
                            />
                            <button
                              type="button"
                              className="desktop-shop-qtybtn"
                              onClick={() => updatePendingQty(product.id, activePendingQty + 1)}
                              aria-label="Sumar cantidad"
                            >
                              +
                            </button>
                          </div>

                          <div className="desktop-shop-qtyconfirm-actions">
                            <button
                              type="button"
                              className="desktop-shop-cancel"
                              onClick={() =>
                                setPendingByProduct((prev) => {
                                  const next = { ...prev };
                                  delete next[product.id];
                                  return next;
                                })
                              }
                              aria-label="Cancelar selección"
                              title="Cancelar"
                            >
                              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                                <path
                                  d="M6 6l12 12M18 6L6 18"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="desktop-shop-confirm"
                              disabled={activePendingQty <= 0}
                              onClick={() => {
                                if (activePendingQty <= 0) return;
                                addItem(buildCartItem(product, pending.activeVariant), activePendingQty);
                                setPendingByProduct((prev) => {
                                  const next = { ...prev };
                                  delete next[product.id];
                                  return next;
                                });
                              }}
                              aria-label="Confirmar cantidad"
                              title="Confirmar"
                            >
                              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                                <path
                                  d="M5 12.5l4.2 4.2L19 7"
                                  stroke="currentColor"
                                  strokeWidth="2.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="desktop-shop-empty">
              No encontramos productos con esos filtros. Probá borrar la búsqueda o ampliar el rango.
            </div>
          ) : null}

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
