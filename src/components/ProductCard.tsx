"use client";

import { motion } from "framer-motion";
import { useState } from "react";
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
  const showImage = Boolean(product.imageUrl) && !imgError;

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
        {tag ? (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
            {tag}
          </div>
        ) : null}
        <div className="relative aspect-square w-full p-4">
          {showImage ? (
            // Using a plain <img> here for faster first paint and predictable error fallback.
            // (The catalog already points to a resized thumb in Firebase Storage.)
            <img
              src={product.imageUrl}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-contain"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={() => setImgError(true)}
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
              {formatArs(product.unit.price)}{" "}
              <span className="text-xs font-medium text-foreground/70">
                · {product.unit.label}
              </span>
            </div>
          </div>
          <MotionButton className="h-9 px-3" onClick={onSelect}>
            Elegir
          </MotionButton>
        </div>
      </div>
    </motion.div>
  );
}
