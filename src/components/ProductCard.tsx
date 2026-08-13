import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/catalog/types";
import { getRemainingStock, useCartStore } from "@/store/cart";
import { Icon } from "./Icons";
import { trackEvent } from "@/lib/analytics";
import { navigateInStore, productPath } from "@/lib/seo";
import { getProductImageUrl, getProductThumbnailUrl } from "@/lib/productImages";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const stockNumber = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function ProductImage({ product, eager, linkToDetail }: { product: Product; eager: boolean; linkToDetail: boolean }) {
  const isReusableCombo = product.categoryId === "combos" && /^P/i.test(product.id.trim());
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const generatedThumbnailUrl = isReusableCombo ? "" : getProductThumbnailUrl(product.id);
  const primaryUrl = isReusableCombo ? "" : product.imageUrl || generatedThumbnailUrl;
  const fallbackUrl = isReusableCombo ? "" : product.imageFallbackUrl ?? "";
  const [resolvedUrl, setResolvedUrl] = useState(primaryUrl);
  const storageAttempted = useRef(false);

  const resolveFromStorage = useCallback(async () => {
    if (isReusableCombo || storageAttempted.current) return false;
    storageAttempted.current = true;
    const url = await getProductImageUrl(product.id);
    if (!url) return false;
    setFailed(false);
    setLoaded(false);
    setResolvedUrl(url);
    return true;
  }, [isReusableCombo, product.id]);

  const improveEagerThumbnail = useCallback(() => {
    if (!eager || !generatedThumbnailUrl || resolvedUrl !== generatedThumbnailUrl) return;
    const run = () => { void resolveFromStorage(); };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 1800 });
    } else {
      setTimeout(run, 500);
    }
  }, [eager, generatedThumbnailUrl, resolveFromStorage, resolvedUrl]);

  useEffect(() => {
    storageAttempted.current = false;
    setResolvedUrl(primaryUrl);
    setLoaded(false);
    setFailed(false);
  }, [primaryUrl, product.id]);

  useEffect(() => {
    if (visible || !host.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "500px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || resolvedUrl || isReusableCombo) return;
    let active = true;
    void resolveFromStorage().then((found) => {
      if (active && !found) setFailed(true);
    });
    return () => { active = false; };
  }, [isReusableCombo, resolveFromStorage, resolvedUrl, visible]);

  const imageContent = <div className={`product-image ${loaded ? "is-loaded" : ""} ${isReusableCombo ? "is-combo" : ""}`} ref={host}>
    {!isReusableCombo ? <div className="image-skeleton" aria-hidden="true" /> : null}
    {!isReusableCombo && visible && resolvedUrl && !failed ? <img src={resolvedUrl} alt={product.name} width="176" height="176" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" onLoad={() => {
      setLoaded(true);
      improveEagerThumbnail();
    }} onError={() => {
      if (fallbackUrl && fallbackUrl !== resolvedUrl) {
        setLoaded(false);
        setResolvedUrl(fallbackUrl);
        return;
      }
      void resolveFromStorage().then((found) => {
        if (!found) setFailed(true);
      });
    }} /> : null}
    {isReusableCombo ? <div className="combo-product-mark" aria-label="Combo con descuento"><span aria-hidden="true">%</span><small>Combo</small></div> : null}
    {!isReusableCombo && (failed || !resolvedUrl) ? <div className="image-fallback"><span>{product.name.slice(0, 1)}</span><small>Sin foto</small></div> : null}
    {product.offer ? <span className="offer-badge">{product.offerCondition === "pack" ? "Oferta por caja" : product.offerCondition === "quantity" ? `Desde ${product.offerMinQty || 2} unid.` : product.offerDiscount ? `-${Math.round(product.offerDiscount)}%` : "Oferta"}</span> : null}
  </div>;

  if (linkToDetail) return <a className="product-image-link" href={productPath(product)} aria-label={`Ver ficha de ${product.name}`} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trackEvent("select_item", { item_id: product.id, item_name: product.name, item_category: product.category });
    navigateInStore(productPath(product));
  }}>{imageContent}</a>;

  return <>
    <button type="button" className="product-image-link product-image-zoom-trigger" aria-label={`Ampliar foto de ${product.name}`} onClick={() => {
      setZoomed(true);
      void resolveFromStorage();
    }}>{imageContent}</button>
    <AnimatePresence>{zoomed ? <motion.div className="product-image-zoom" role="dialog" aria-modal="true" aria-label={`Foto ampliada de ${product.name}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomed(false)}>
      <button type="button" className="product-image-zoom-close" onClick={() => setZoomed(false)} aria-label="Cerrar foto ampliada">Cerrar</button>
      {resolvedUrl && !failed ? <motion.img src={resolvedUrl} alt={product.name} width="900" height="900" initial={{ scale: .96 }} animate={{ scale: 1 }} exit={{ scale: .96 }} onClick={(event) => event.stopPropagation()}/> : imageContent}
    </motion.div> : null}</AnimatePresence>
  </>;
}

function ProductCardInner({ product, eager = false, linkImageToDetail = true, detailCompact = false, onPriceChange }: { product: Product; eager?: boolean; linkImageToDetail?: boolean; detailCompact?: boolean; onPriceChange?: (price: number) => void }) {
  const reduceMotion = useReducedMotion();
  const [variant, setVariant] = useState<"unit" | "pack">("unit");
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const itemId = `${product.id}:${variant}`;
  const item = items.find((entry) => entry.id === itemId);
  const option = variant === "pack" && product.pack ? product.pack : product.unit;
  const packUnitPriceFinal = variant === "pack" && product.pack
    ? option.price / Math.max(1, product.pack.qty)
    : null;
  const packHasPromo = variant === "pack" && Boolean(
    option.discountPct || (option.listPrice && option.listPrice > option.price),
  );
  const remainingStock = getRemainingStock(items, product.id, product.stockReal);
  const unitsNeeded = variant === "pack" ? Math.max(1, product.pack?.qty || 1) : 1;
  const available = product.active && (remainingStock === undefined || remainingStock >= unitsNeeded);
  const exhausted = product.active && remainingStock !== undefined && remainingStock <= 0;

  useEffect(() => {
    onPriceChange?.(option.price);
  }, [onPriceChange, option.price]);

  const add = () => {
    addItem({ id: itemId, productId: product.id, name: product.name, variant, label: option.label, price: option.price, listPrice: option.listPrice, discountPct: option.discountPct, unitPriceFinal: variant === "pack" ? option.price / Math.max(1, product.pack?.qty || 1) : option.price, unitsPerPack: variant === "pack" ? product.pack?.qty : 1, stockLimit: product.stockReal, promoPackQty: product.pack?.qty, promoPackUnitPrice: product.packPromoUnitPrice, offerMinQty: product.offerMinQty, offerUnitPrice: product.offerUnitPrice, offerAllowCoupons: product.offerAllowCoupons, offerMaxUnits: product.offerMaxUnits }, 1);
    trackEvent("add_to_cart", { item_id: product.id, item_name: product.name, item_category: product.category, price: option.price, currency: "ARS", variant });
  };

  return <motion.article className={`product-card ${detailCompact ? "is-detail-compact" : ""} ${!product.active ? "is-unavailable" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
    <div className="product-media">
      <ProductImage product={product} eager={eager} linkToDetail={linkImageToDetail} />
      {!detailCompact ? remainingStock !== undefined ? <div className={`product-stock ${remainingStock <= 0 ? "is-empty" : ""}`}><span>Stock disponible:</span> <strong>{stockNumber.format(remainingStock)} unidades</strong></div> : <div className="product-stock is-unknown">Stock sin informar</div> : null}
    </div>
    <div className="product-content">
      {!detailCompact ? <><div className="product-copy">
        <div className="eyebrow-row"><span>{product.brand}</span>{!product.active || exhausted ? <strong>Sin stock</strong> : null}</div>
        <h3>{product.name}</h3>
        <p>{option.label}</p>
      </div>
      <div className={`product-price ${option.listPrice && option.listPrice > option.price ? "has-offer" : ""}`}>
        {option.listPrice && option.listPrice > option.price ? <span>{money.format(option.listPrice)}</span> : null}
        <strong>{money.format(option.price)}</strong>
        {packUnitPriceFinal !== null
          ? <small className={`unit-price-final ${packHasPromo ? "is-promo" : ""}`}>Pr. Unit. Final: <b>{money.format(packUnitPriceFinal)}</b></small>
          : option.discountPct ? <small>Ahorrás {Math.round(option.discountPct)}%</small> : null}
      </div></> : null}
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
