import { memo, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/catalog/types";
import { useCartStore } from "@/store/cart";
import { Icon } from "./Icons";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function ProductImage({ product, eager }: { product: Product; eager: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

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

  return <div className={`product-image ${loaded ? "is-loaded" : ""}`} ref={host}>
    <div className="image-skeleton" aria-hidden="true" />
    {visible && product.imageUrl && !failed ? <img src={product.imageUrl} alt={product.name} width="176" height="176" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
    {failed || !product.imageUrl ? <div className="image-fallback"><span>{product.name.slice(0, 1)}</span><small>Sin foto</small></div> : null}
    {product.offer ? <span className="offer-badge">-{Math.round(product.offerDiscount ?? 0)}%</span> : null}
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
    <ProductImage product={product} eager={eager} />
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
