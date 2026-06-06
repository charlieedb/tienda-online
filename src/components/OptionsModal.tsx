"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { MotionButton } from "@/components/MotionButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type Props = {
  open: boolean;
  activeToken: string | null;
  searchMode?: "free" | "category";
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
  searchMode = "free",
  onClose,
  onAdded,
  onSearchState,
  pulse = 0,
}: Props) {
  useBodyScrollLock(open);

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
            className="modal-backdrop-lite fixed inset-0 z-[55]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed left-1/2 top-1/2 z-[60] flex h-[min(58svh,470px)] max-h-[calc(100svh-0.75rem)] w-[min(560px,calc(100vw-0.75rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-border app-modal-surface shadow-2xl sm:h-[min(61svh,500px)] sm:w-[min(560px,calc(100vw-1.25rem))] md:h-[min(70vh,720px)] md:w-[min(560px,calc(100vw-3rem))]"
            style={{
              paddingBottom: "max(0px, env(safe-area-inset-bottom))",
            }}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4 sm:py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Opciones</div>
                <div className="text-[11px] font-medium text-foreground/65">
                  Podés agregar varias marcas.
                </div>
              </div>
              <MotionButton tone="ghost" className="h-8 shrink-0 px-3 sm:h-9" onClick={onClose}>
                Cerrar
              </MotionButton>
            </div>
            <div className="min-h-0 flex-1 p-3 sm:p-4">
              <SuggestionsPanel
                activeToken={activeToken}
                searchMode={searchMode}
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

