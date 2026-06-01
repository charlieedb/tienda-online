"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { getOffersOfDay } from "@/lib/offers";
import { ProductCard } from "@/components/ProductCard";
import { QuantityModal } from "@/components/QuantityModal";
import { useCartStore } from "@/store/cart";

type Props = {
  open: boolean;
  onAdded?: () => void;
  onOfferAdded?: (info: {
    productId: string;
    name: string;
    variant: "unit" | "pack";
    qty: number;
  }) => void;
};

export function OffersPanel({ open, onAdded, onOfferAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Product | null>(null);
  const [qtyOpen, setQtyOpen] = useState(false);

  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getOffersOfDay(0);
        if (cancelled) return;
        setProducts(result);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error");
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = useMemo(() => products, [products]);

  return (
    <div className="flex h-full flex-col">
      <QuantityModal
        open={qtyOpen}
        product={selected}
        mode="add"
        onClose={() => setQtyOpen(false)}
        onConfirm={({ product, variant, qty, label, price }) => {
          addItem(
            {
              id: `${product.id}:${variant}`,
              productId: product.id,
              name: `${product.name}${product.brand ? ` · ${product.brand}` : ""}`,
              variant,
              label,
              price,
            },
            qty,
          );
          onOfferAdded?.({ productId: product.id, name: product.name, variant, qty });
          setQtyOpen(false);
          onAdded?.();
        }}
      />

      <div className="text-xs font-semibold text-foreground/70">Ofertas del día</div>

      <div className="no-scrollbar mt-3 flex-1 overflow-hidden">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            Cargando ofertas…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-foreground/70">
            Muy pronto: todavía no hay ofertas.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <motion.div layout className="relative flex-1">
              <div className="mb-2 flex justify-center md:hidden">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-semibold text-foreground/70">
                  <span aria-hidden="true" className="text-[12px] leading-none">
                    ⇆
                  </span>
                  Deslizá para ver más
                </div>
              </div>

              <div className="no-scrollbar -mr-2 overflow-x-auto overflow-y-hidden pr-2 [scrollbar-gutter:stable] [scrollbar-width:none]">
                <div className="flex snap-x snap-mandatory gap-3 pb-2">
                  {visible.map((p) => (
                    <div
                      key={p.id}
                      className="relative w-[82%] shrink-0 snap-center md:w-[360px]"
                    >
                      <div className="relative overflow-hidden rounded-2xl">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -right-14 top-6 z-20 w-48 rotate-45 bg-[#2b3bb8] py-2 text-center text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-black/25"
                        >
                          OFERTA
                        </div>
                        <ProductCard
                          product={p}
                          tone="offers"
                          onSelect={() => {
                            setSelected(p);
                            setQtyOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
