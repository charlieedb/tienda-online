import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/catalog/types";
import { getRemainingStock, useCartStore } from "@/store/cart";
import { Icon } from "./Icons";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const stockNumber = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function ProductImage({ product, eager }: { product: Product; eager: boolean }) {
  const isReusableCombo = product.categoryId === "combos" && /^P/i.test(product.id.trim());
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolvedUrl = isReusableCombo ? "" : product.imageUrl ?? "";

  useEffect(() => {
    if (visible || !host.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "180px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible]);

  return <div className={`product-image ${loaded ? "is-loaded" : ""} ${isReusableCombo ? "is-combo" : ""}`} ref={host}>
    {!isReusableCombo ? <div className="image-skeleton" aria-hidden="true" /> : null}
    {!isReusableCombo && visible && resolvedUrl && !failed ? <img src={resolvedUrl} alt={product.name} width="176" height="176" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
    {isReusableCombo ? <div className="combo-product-mark" aria-label="Combo con descuento"><span aria-hidden="true">%</span><small>Combo</small></div> : null}
    {!isReusableCombo && (failed || !resolvedUrl) ? <div className="image-fallback"><span>{product.name.slice(0, 1)}</span><small>Sin foto</small></div> : null}
    {product.offer ? <span className="offer-badge">{product.offerCondition === "pack" ? "Oferta por caja" : product.offerDiscount ? `-${Math.round(product.offerDiscount)}%` : "Oferta"}</span> : null}
  </div>;
}

function ProductCardInner({ product, eager = false }: { product: Product; eager?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [variant, setVariant] = useState<"unit" | "pack">("unit");
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const itemId = `${product.id}:${variant}`;
  const item = items.find((entry) => entry.id === itemId);
  const option = variant === "pack" && product.pack ? product.pack : product.unit;
  const remainingStock = getRemainingStock(items, product.id, product.stockReal);
  const unitsNeeded = variant === "pack" ? Math.max(1, product.pack?.qty || 1) : 1;
  const available = product.active && (remainingStock === undefined || remainingStock >= unitsNeeded);
  const exhausted = product.active && remainingStock !== undefined && remainingStock <= 0;

  const add = () => addItem({ id: itemId, productId: product.id, name: product.name, variant, label: option.label, price: option.price, listPrice: option.listPrice, discountPct: option.discountPct, unitPriceFinal: variant === "pack" ? option.price / Math.max(1, product.pack?.qty || 1) : option.price, unitsPerPack: variant === "pack" ? product.pack?.qty : 1, stockLimit: product.stockReal }, 1);

  return <motion.article className={`product-card ${!product.active ? "is-unavailable" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
    <div className="product-media">
      <ProductImage product={product} eager={eager} />
      {remainingStock !== undefined ? <div className={`product-stock ${remainingStock <= 0 ? "is-empty" : ""}`}><span>Stock disponible:</span> <strong>{stockNumber.format(remainingStock)} unidades</strong></div> : <div className="product-stock is-unknown">Stock sin informar</div>}
    </div>
    <div className="product-content">
      <div className="product-copy">
        <div className="eyebrow-row"><span>{product.brand}</span>{!product.active || exhausted ? <strong>Sin stock</strong> : null}</div>
        <h3>{product.name}</h3>
        <p>{option.label}</p>
      </div>
      <div className={`product-price ${option.listPrice && option.listPrice > option.price ? "has-offer" : ""}`}>
        {option.listPrice && option.listPrice > option.price ? <span>{money.format(option.listPrice)}</span> : null}
        <strong>{money.format(option.price)}</strong>
        {option.discountPct ? <small>Ahorrás {Math.round(option.discountPct)}%</small> : null}
      </div>
      {product.pack ? <div className="variant-switch" role="group" aria-label={`Presentación de ${product.name}`}>
        <button type="button" className={variant === "unit" ? "is-active" : ""} onClick={() => setVariant("unit")} aria-pressed={variant === "unit"}>Unidad</button>
        <button type="button" className={variant === "pack" ? "is-active" : ""} onClick={() => setVariant("pack")} aria-pressed={variant === "pack"}>Caja</button>
      </div> : null}
      {!item ? <button type="button" className="add-button" onClick={add} disabled={!available}>Agregar</button> : <div className="stepper" aria-label={`Cantidad de ${product.name}`}>
        <button type="button" onClick={() => setItemQty(item.id, item.qty - 1)} aria-label="Quitar una unidad"><Icon name="minus" /></button>
        <output aria-live="polite">{item.qty}</output>
        <button type="button" onClick={() => setItemQty(item.id, item.qty + 1)} aria-label="Agregar una unidad" disabled={!available}><Icon name="plus" /></button>
      </div>}
    </div>
  </motion.article>;
}

export const ProductCard = memo(ProductCardInner);
