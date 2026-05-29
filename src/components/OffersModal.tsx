"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { MotionButton } from "@/components/MotionButton";
import { OffersPanel } from "@/components/OffersPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  onOfferAdded?: (info: {
    productId: string;
    name: string;
    variant: "unit" | "pack";
    qty: number;
  }) => void;
};

export function OffersModal({ open, onClose, onOfferAdded }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            aria-label="Cerrar ofertas"
            className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed left-1/2 top-1/2 z-[60] h-[min(74vh,760px)] w-[min(640px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f3f1f1] shadow-2xl dark:bg-zinc-950"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">
                Ofertas del Día
              </div>
              <MotionButton tone="ghost" className="h-9 px-3" onClick={onClose}>
                Cerrar
              </MotionButton>
            </div>
            <div className="h-[calc(100%-52px)] p-4">
              <OffersPanel open={open} onAdded={onClose} onOfferAdded={onOfferAdded} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
