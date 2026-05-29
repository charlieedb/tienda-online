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
        const result = await getOffersOfDay(8);
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

  const visible = useMemo(() => products.slice(0, 8), [products]);

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

      <div className="no-scrollbar mt-3 flex-1 overflow-auto">
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
            <motion.div layout className="flex flex-col gap-1">
              {visible.map((p) => (
                <div key={p.id} className="relative">
                  <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                    OFERTA
                  </div>
                  <ProductCard
                    product={p}
                    tag="OFERTA"
                    onSelect={() => {
                      setSelected(p);
                      setQtyOpen(true);
                    }}
                  />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
