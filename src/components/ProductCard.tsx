import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/catalog/types";
import { useCartStore } from "@/store/cart";
import { Icon } from "./Icons";
import { getProductImageUrl } from "@/lib/productImages";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const stockNumber = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function ProductImage({ product, eager }: { product: Product; eager: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(product.imageUrl ?? "");
  const [resolved, setResolved] = useState(Boolean(product.imageUrl));

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

  useEffect(() => {
    if (!visible || resolved) return;
    let active = true;
    getProductImageUrl(product.id).then((url) => {
      if (!active) return;
      setResolvedUrl(url);
      setResolved(true);
      if (!url) setFailed(true);
    });
    return () => { active = false; };
  }, [product.id, resolved, visible]);

  return <div className={`product-image ${loaded ? "is-loaded" : ""}`} ref={host}>
    <div className="image-skeleton" aria-hidden="true" />
    {visible && resolvedUrl && !failed ? <img src={resolvedUrl} alt={product.name} width="176" height="176" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
    {resolved && (failed || !resolvedUrl) ? <div className="image-fallback"><span>{product.name.slice(0, 1)}</span><small>Sin foto</small></div> : null}
    {product.offer ? <span className="offer-badge">{product.offerDiscount ? `-${Math.round(product.offerDiscount)}%` : "Oferta"}</span> : null}
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
  const available = product.active;

  const add = () => addItem({ id: itemId, productId: product.id, name: product.name, variant, label: option.label, price: option.price, unitsPerPack: variant === "pack" ? product.pack?.qty : 1 }, 1);

  return <motion.article className={`product-card ${!available ? "is-unavailable" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
    <div className="product-media">
      <ProductImage product={product} eager={eager} />
      {product.stockReal !== undefined ? <div className={`product-stock ${product.stockReal <= 0 ? "is-empty" : ""}`}><span>Stock</span><strong>{stockNumber.format(product.stockReal)}</strong></div> : <div className="product-stock is-unknown">Stock sin informar</div>}
    </div>
    <div className="product-content">
      <div className="product-copy">
        <div className="eyebrow-row"><span>{product.brand}</span>{!available ? <strong>Sin stock</strong> : null}</div>
        <h3>{product.name}</h3>
        <p>{option.label}</p>
      </div>
      <div className="product-price">{money.format(option.price)}</div>
      {product.pack ? <div className="variant-switch" role="group" aria-label={`Presentación de ${product.name}`}>
        <button type="button" className={variant === "unit" ? "is-active" : ""} onClick={() => setVariant("unit")} aria-pressed={variant === "unit"}>Unidad</button>
        <button type="button" className={variant === "pack" ? "is-active" : ""} onClick={() => setVariant("pack")} aria-pressed={variant === "pack"}>Caja</button>
      </div> : null}
      {!item ? <button type="button" className="add-button" onClick={add} disabled={!available}>Agregar</button> : <div className="stepper" aria-label={`Cantidad de ${product.name}`}>
        <button type="button" onClick={() => setItemQty(item.id, item.qty - 1)} aria-label="Quitar una unidad"><Icon name="minus" /></button>
        <output aria-live="polite">{item.qty}</output>
        <button type="button" onClick={() => setItemQty(item.id, item.qty + 1)} aria-label="Agregar una unidad"><Icon name="plus" /></button>
      </div>}
    </div>
  </motion.article>;
}

export const ProductCard = memo(ProductCardInner);
