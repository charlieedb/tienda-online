"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { formatArs } from "@/lib/format";
import { MotionButton } from "@/components/MotionButton";

type Variant = "unit" | "pack";

type Props = {
  open: boolean;
  product: Product | null;
  initialVariant?: Variant;
  initialQty?: number;
  mode?: "add" | "edit";
  onDeleteSelection?: () => void;
  onClose: () => void;
  onConfirm: (args: {
    product: Product;
    variant: Variant;
    qty: number;
    label: string;
    price: number;
  }) => void;
};

export function QuantityModal({
  open,
  product,
  initialVariant,
  initialQty,
  mode = "add",
  onDeleteSelection,
  onClose,
  onConfirm,
}: Props) {
  const hasPack = Boolean(product?.pack);
  const isOut = product?.active === false;
  const [variant, setVariant] = useState<Variant>("unit");
  const [qty, setQty] = useState(1);

  const discountPct = product?.offer ? product.offerDiscount ?? 0 : 0;
  const hasDiscount = discountPct > 0;
  const applyDiscount = (price: number) =>
    hasDiscount ? Math.max(0, Math.round(price * (1 - discountPct / 100))) : price;

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setVariant("unit");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextQty = Math.max(1, Math.min(99, Math.trunc(initialQty ?? 1)));
    setQty(nextQty);

    const nextVariant: Variant = initialVariant ?? "unit";
    if (nextVariant === "pack" && !hasPack) {
      setVariant("unit");
    } else {
      setVariant(nextVariant);
    }
  }, [open, hasPack, initialQty, initialVariant]);

  const variantInfo = useMemo(() => {
    if (!product) return null;
    if (variant === "pack" && product.pack) {
      return {
        label: product.pack.label,
        price: applyDiscount(product.pack.price),
        originalPrice: product.pack.price,
      };
    }
    return {
      label: product.unit.label,
      price: applyDiscount(product.unit.price),
      originalPrice: product.unit.price,
    };
  }, [product, variant, discountPct]);

  if (!product) return null;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            aria-label="Cerrar"
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-[70] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-white shadow-2xl dark:bg-zinc-950"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm font-semibold text-foreground">
                  {product.name}
                  {product.brand ? (
                    <span className="font-semibold text-foreground/60">
                      {" "}
                      · {product.brand}
                    </span>
                  ) : null}
                </div>
                {mode === "edit" ? (
                  <button
                    type="button"
                    onClick={onDeleteSelection}
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-foreground/70">
                Elegí formato y cantidad
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVariant("unit")}
                  className={[
                    "rounded-2xl border px-3 py-3 text-left transition-colors",
                    variant === "unit"
                      ? "border-[#2b3bb8]/40 bg-[#2b3bb8]/12 ring-2 ring-[#2b3bb8]/20"
                      : "border-border bg-surface hover:bg-surface-2",
                  ].join(" ")}
                >
                  <div className="text-xs font-semibold text-foreground/70">
                    Unidades
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {hasDiscount ? (
                      <span className="inline-flex items-baseline gap-2">
                        <span>{formatArs(applyDiscount(product.unit.price))}</span>
                        <span className="text-xs font-semibold text-foreground/45 line-through">
                          {formatArs(product.unit.price)}
                        </span>
                      </span>
                    ) : (
                      formatArs(product.unit.price)
                    )}{" "}
                    <span className="text-xs font-medium text-foreground/65">
                      · {product.unit.label}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => hasPack && setVariant("pack")}
                  disabled={!hasPack}
                  className={[
                    "rounded-2xl border px-3 py-3 text-left transition-colors",
                    !hasPack ? "cursor-not-allowed opacity-45" : "",
                    variant === "pack"
                      ? "border-[#2b3bb8]/40 bg-[#2b3bb8]/12 ring-2 ring-[#2b3bb8]/20"
                      : "border-border bg-surface hover:bg-surface-2",
                  ].join(" ")}
                >
                  <div className="text-xs font-semibold text-foreground/70">
                    Cajas
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {product.pack ? (
                      <>
                        {hasDiscount ? (
                          <span className="inline-flex items-baseline gap-2">
                            <span>{formatArs(applyDiscount(product.pack.price))}</span>
                            <span className="text-xs font-semibold text-foreground/45 line-through">
                              {formatArs(product.pack.price)}
                            </span>
                          </span>
                        ) : (
                          formatArs(product.pack.price)
                        )}{" "}
                        <span className="text-xs font-medium text-foreground/65">
                          · {product.pack.label}
                        </span>
                      </>
                    ) : (
                      "No disponible"
                    )}
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-foreground/70">
                      Cantidad
                    </div>
                    <div className="text-xs text-foreground/60">
                      {variantInfo?.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MotionButton
                      type="button"
                      tone="soft"
                      className="h-9 w-9 px-0"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Restar"
                    >
                      −
                    </MotionButton>
                    <input
                      value={qty}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setQty(Math.max(1, Math.min(99, Math.trunc(n))));
                      }}
                      inputMode="numeric"
                      className="h-9 w-14 rounded-xl border border-border bg-white text-center text-sm font-semibold text-black outline-none"
                    />
                    <MotionButton
                      type="button"
                      tone="soft"
                      className="h-9 w-9 px-0"
                      onClick={() => setQty((q) => Math.min(99, q + 1))}
                      aria-label="Sumar"
                    >
                      +
                    </MotionButton>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-foreground/70">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatArs((variantInfo?.price ?? 0) * qty)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MotionButton type="button" tone="ghost" onClick={onClose}>
                    Cancelar
                  </MotionButton>
                  <MotionButton
                    type="button"
                    onClick={() => {
                      if (!product || !variantInfo) return;
                      onConfirm({
                        product,
                        variant,
                        qty,
                        label: variantInfo.label,
                        price: variantInfo.price,
                      });
                    }}
                    disabled={isOut}
                  >
                    Confirmar
                  </MotionButton>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
