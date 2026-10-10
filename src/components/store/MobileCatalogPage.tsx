"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MotionButton } from "@/components/MotionButton";
import { formatArs } from "@/lib/format";
import { normalizeToken } from "@/lib/normalize";
import type { Product } from "@/lib/products";
import { useCartStore } from "@/store/cart";

export type StoreCategory = {
  token: string;
  label: string;
  subcategories: Array<{ token: string; label: string }>;
};

type Props = {
  products: Product[];
  categories: StoreCategory[];
  categoryToken: string | null;
  offersOnly: boolean;
  onCategoryTokenChange: (token: string | null) => void;
  onOffersOnlyChange: (value: boolean) => void;
};

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

export function MobileCatalogPage({
  products,
  categories,
  categoryToken,
  offersOnly,
  onCategoryTokenChange,
  onOffersOnlyChange,
}: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [variantByProduct, setVariantByProduct] = useState<Record<string, "unit" | "pack">>({});
  const [pendingByProduct, setPendingByProduct] = useState<Record<string, PendingState>>({});

  const normalizedSearch = normalizeToken(deferredSearch);
  const hasSelectedSubcategory = Boolean(categoryToken?.includes("::"));
  const shouldShowProducts = Boolean(
    offersOnly || normalizedSearch || !categoryToken || hasSelectedSubcategory,
  );

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.token === categoryToken?.split("::")[0]),
    [categories, categoryToken],
  );

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      if (offersOnly && !product.offer) return false;
      if (categoryToken) {
        const [categoryPart, subcategoryPart] = categoryToken.split("::");
        if (normalizeToken(product.category || "") !== categoryPart) return false;
        if (subcategoryPart && normalizeToken(product.subcategory || product.brand || "") !== subcategoryPart) return false;
      }
      if (!normalizedSearch) return true;
      const haystack = normalizeToken(
        [product.name, product.id, product.brand, product.category, product.subcategory, ...(product.keywords || [])]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(normalizedSearch);
    });
  }, [activeProducts, categoryToken, normalizedSearch, offersOnly]);

  const productsInCart = useMemo(() => {
    const map = new Map<string, { unit: number; pack: number }>();
    for (const item of cartItems) {
      const current = map.get(item.productId) ?? { unit: 0, pack: 0 };
      current[item.variant] += item.qty;
      map.set(item.productId, current);
    }
    return map;
  }, [cartItems]);

  const totalCartItems = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.qty, 0),
    [cartItems],
  );

  const totalCartAmount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.price * item.qty, 0),
    [cartItems],
  );

  useEffect(() => {
    setPendingByProduct({});
  }, [categoryToken, offersOnly, normalizedSearch]);

  return (
    <section className="store-catalog store-catalog--mobile">
      <div className="store-surface store-catalog__hero">
        <div className="store-kicker">Tienda Online</div>
        <h1 className="store-title store-title--compact">
          Comprá rápido, con precios grandes y opciones claras.
        </h1>
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

        <div className="store-chip-row">
          <FilterChip
            active={!categoryToken && !offersOnly}
            onClick={() => {
              onCategoryTokenChange(null);
              onOffersOnlyChange(false);
            }}
          >
            Todo
          </FilterChip>
          <FilterChip
            active={offersOnly}
            onClick={() => {
              onCategoryTokenChange(null);
              onOffersOnlyChange(true);
            }}
          >
            Ofertas
          </FilterChip>
        </div>
        <div className="store-mobile-category-menu" aria-label="Categorías de productos">
          {categories.map((category) => {
            const expanded = !offersOnly && selectedCategory?.token === category.token;
            return (
              <div key={category.token} className={`store-category-menu ${expanded ? "is-expanded" : ""}`}>
                <button
                  type="button"
                  className={`store-mobile-category-menu__trigger ${expanded ? "is-active" : ""}`}
                  aria-expanded={expanded}
                  onClick={() => {
                    onCategoryTokenChange(expanded ? null : category.token);
                    onOffersOnlyChange(false);
                  }}
                >
                  <span>{category.label}</span>
                  <span className="store-category-menu__chevron" aria-hidden="true" />
                </button>
                {expanded && category.subcategories.length ? (
                  <div className="store-mobile-category-menu__submenu" aria-label={`Subcategorías de ${category.label}`}>
                    {category.subcategories.map((subcategory) => (
                      <button
                        key={subcategory.token}
                        type="button"
                        className={categoryToken === `${category.token}::${subcategory.token}` ? "is-active" : ""}
                        onClick={() => onCategoryTokenChange(`${category.token}::${subcategory.token}`)}
                      >
                        {subcategory.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="store-catalog__summary">
          <div>
            <strong>{shouldShowProducts ? filteredProducts.length : 0}</strong>
            <span>productos visibles</span>
          </div>
          <div>
            <strong>{totalCartItems}</strong>
            <span>ítems en carrito</span>
          </div>
          <div>
            <strong>{formatArs(totalCartAmount)}</strong>
            <span>total estimado</span>
          </div>
        </div>
      </div>

      <div className="store-product-stack">
        {!shouldShowProducts && selectedCategory ? (
          <div className="store-empty store-empty--subcategory-prompt">
            <strong>{selectedCategory.label}</strong>
            <span>Elegí una subcategoría para ver sus productos.</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="store-empty">
            No encontramos productos con ese filtro. Probá con otra búsqueda o volvé a ver todo.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const selectedVariant =
              variantByProduct[product.id] === "pack" && product.pack ? "pack" : "unit";
            const pending = pendingByProduct[product.id] ?? null;
            const activePendingQty = pending ? pending.qtyByVariant[pending.activeVariant] : 0;
            const selectedPrice =
              selectedVariant === "pack" && product.pack ? product.pack.price : product.unit.price;
            const cartState = productsInCart.get(product.id) ?? { unit: 0, pack: 0 };

            return (
              <article key={product.id} className="store-surface store-product-card">
                <div className="store-product-card__topline">
                  <div className="store-product-card__meta">
                    <span>{product.category || "Catálogo"}</span>
                    <span>{product.subcategory || product.brand || "Selección JOMA"}</span>
                  </div>
                  {product.offer ? <span className="store-badge">Oferta</span> : null}
                </div>

                <h2 className="store-product-card__title">{product.name}</h2>

                <div className="store-product-card__priceband">
                  <div>
                    <span className="store-label">Precio activo</span>
                    <strong>{formatArs(selectedPrice)}</strong>
                  </div>
                  <div className="store-product-card__totals">
                    {cartState.unit ? <small>{cartState.unit} U</small> : null}
                    {cartState.pack ? <small>{cartState.pack} C</small> : null}
                  </div>
                </div>

                <div className="store-variant-toggle">
                  <button
                    type="button"
                    className={`store-variant-toggle__option ${selectedVariant === "unit" ? "is-active" : ""}`}
                    aria-pressed={selectedVariant === "unit"}
                    onClick={() =>
                      setVariantByProduct((prev) => ({
                        ...prev,
                        [product.id]: "unit",
                      }))
                    }
                  >
                    <span>Unidad</span>
                    <strong>{formatArs(product.unit.price)}</strong>
                  </button>

                  {product.pack ? (
                    <button
                      type="button"
                      className={`store-variant-toggle__option ${selectedVariant === "pack" ? "is-active" : ""}`}
                      aria-pressed={selectedVariant === "pack"}
                      onClick={() =>
                        setVariantByProduct((prev) => ({
                          ...prev,
                          [product.id]: "pack",
                        }))
                      }
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
                      setPendingByProduct((prev) => ({
                        ...prev,
                        [product.id]: {
                          activeVariant: selectedVariant,
                          qtyByVariant: { unit: 1, pack: 1 },
                        },
                      }))
                    }
                  >
                    Agregar al carrito
                  </MotionButton>
                ) : (
                  <div className="store-inline-qty">
                    <div className="store-inline-qty__stepper">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingByProduct((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              qtyByVariant: {
                                ...prev[product.id].qtyByVariant,
                                [prev[product.id].activeVariant]: Math.max(1, activePendingQty - 1),
                              },
                            },
                          }))
                        }
                      >
                        −
                      </button>
                      <input
                        value={activePendingQty}
                        onChange={(event) => {
                          const next = Math.max(1, Math.min(999, Math.trunc(Number(event.target.value || 1))));
                          setPendingByProduct((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              qtyByVariant: {
                                ...prev[product.id].qtyByVariant,
                                [prev[product.id].activeVariant]: next,
                              },
                            },
                          }));
                        }}
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingByProduct((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              qtyByVariant: {
                                ...prev[product.id].qtyByVariant,
                                [prev[product.id].activeVariant]: Math.min(999, activePendingQty + 1),
                              },
                            },
                          }))
                        }
                      >
                        +
                      </button>
                    </div>

                    <div className="store-inline-qty__actions">
                      <button
                        type="button"
                        className="store-inline-qty__cancel"
                        onClick={() =>
                          setPendingByProduct((prev) => {
                            const next = { ...prev };
                            delete next[product.id];
                            return next;
                          })
                        }
                      >
                        Cancelar
                      </button>
                      <MotionButton
                        type="button"
                        className="store-inline-qty__confirm"
                        onClick={() => {
                          addItem(buildCartItem(product, pending.activeVariant), activePendingQty);
                          setPendingByProduct((prev) => {
                            const next = { ...prev };
                            delete next[product.id];
                            return next;
                          });
                        }}
                      >
                        Confirmar
                      </MotionButton>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`store-chip ${active ? "is-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
