"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { formatArs } from "@/lib/format";
import type { Product } from "@/lib/products";
import { MotionButton } from "@/components/MotionButton";

type Props = {
  product: Product;
  onSelect: () => void;
  tag?: "OFERTA";
};

export function ProductCard({ product, onSelect, tag }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const isOut = product.active === false;

  const fullImageUrl = useMemo(() => {
    const u = String(product.imageUrl ?? "").trim();
    if (!u) return "";
    return u
      .replace("fotosProductosThumb%2F", "fotosProductos%2F")
      .replace("/fotosProductosThumb/", "/fotosProductos/");
  }, [product.imageUrl]);

  const [imgSrc, setImgSrc] = useState<string | null>(product.imageUrl ?? null);
  useEffect(() => {
    setImgError(false);
    setImgSrc(product.imageUrl ?? null);
    setImgLoaded(false);
  }, [product.imageUrl]);

  useEffect(() => {
    if (!imgSrc) return;
    if (!fullImageUrl) return;
    if (fullImageUrl === imgSrc) return;
    const pre = new Image();
    pre.src = fullImageUrl;
    pre.onload = () => setImgSrc(fullImageUrl);
  }, [fullImageUrl, imgSrc]);

  const showImage = Boolean(imgSrc) && !imgError;

  const hasDiscount = Boolean(product.offer && (product.offerDiscount ?? 0) > 0);
  const discount = product.offerDiscount ?? 0;
  const unitOriginal = product.unit.price;
  const unitDiscounted = hasDiscount
    ? Math.max(0, Math.round(unitOriginal * (1 - discount / 100)))
    : unitOriginal;

  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-surface p-3 shadow-sm"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {isOut ? (
            <div className="rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              Sin stock
            </div>
          ) : null}
          {tag ? (
            <div className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              {tag}
            </div>
          ) : null}
        </div>
        <div className="relative aspect-square w-full p-4">
          <div
            aria-hidden="true"
            className={[
              "absolute inset-0",
              "bg-gradient-to-br from-black/5 via-black/0 to-black/10",
              "transition-opacity duration-300",
              imgLoaded ? "opacity-0" : "opacity-100",
            ].join(" ")}
          />
          {showImage ? (
            // Using a plain <img> here for faster first paint and predictable error fallback.
            // (The catalog already points to a resized thumb in Firebase Storage.)
            <img
              src={imgSrc ?? undefined}
              alt={product.name}
              className={[
                "absolute inset-0 h-full w-full object-contain",
                "transition-opacity duration-300",
                imgLoaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgError(true);
                setImgLoaded(false);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-black tracking-tight text-foreground/50">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="px-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {product.name}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
          <div>
            <div className="text-xs font-semibold text-foreground/70">
              {product.brand ?? " "}
            </div>
            <div className="text-sm font-semibold text-foreground">
              {hasDiscount ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className="text-foreground">{formatArs(unitDiscounted)}</span>
                  <span className="text-xs font-semibold text-foreground/45 line-through">
                    {formatArs(unitOriginal)}
                  </span>
                </span>
              ) : (
                formatArs(unitOriginal)
              )}{" "}
              <span className="text-xs font-medium text-foreground/70">
                · {product.unit.label}
              </span>
            </div>
          </div>
          <MotionButton className="h-9 px-3" onClick={onSelect} disabled={isOut}>
            {isOut ? "Sin stock" : "Elegir"}
          </MotionButton>
        </div>
      </div>
    </motion.div>
  );
}
