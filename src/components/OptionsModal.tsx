"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { MotionButton } from "@/components/MotionButton";

type Props = {
  open: boolean;
  activeToken: string | null;
  onClose: () => void;
  onAdded: (info: {
    productId: string;
    variant: "unit" | "pack";
    qty: number;
    label: string;
  }) => void;
  onSearchState: (state: { token: string; hasResults: boolean }) => void;
  pulse?: number;
};

export function OptionsModal({
  open,
  activeToken,
  onClose,
  onAdded,
  onSearchState,
  pulse = 0,
}: Props) {
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
            aria-label="Cerrar opciones"
            className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Desktop floating modal */}
          <motion.aside
            className="fixed left-1/2 top-1/2 z-[60] hidden h-[min(70vh,720px)] w-[min(560px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f3f1f1] shadow-2xl dark:bg-zinc-950 md:block"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">Opciones</div>
              <MotionButton tone="ghost" className="h-9 px-3" onClick={onClose}>
                Cerrar
              </MotionButton>
            </div>
            <div className="h-[calc(100%-52px)] p-4">
              <SuggestionsPanel
                activeToken={activeToken}
                onAdded={onAdded}
                onSearchState={onSearchState}
                pulse={pulse}
              />
            </div>
          </motion.aside>

          {/* Mobile bottom sheet modal */}
          <motion.aside
            className="fixed inset-x-3 bottom-3 z-[60] h-[78vh] overflow-hidden rounded-3xl border border-border bg-[#f3f1f1] shadow-2xl dark:bg-zinc-950 md:hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 520, damping: 44 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/15" />
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">Opciones</div>
              <MotionButton tone="ghost" className="h-9 px-3" onClick={onClose}>
                Cerrar
              </MotionButton>
            </div>
            <div className="h-[calc(100%-74px)] p-4">
              <SuggestionsPanel
                activeToken={activeToken}
                onAdded={onAdded}
                onSearchState={onSearchState}
                pulse={pulse}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
