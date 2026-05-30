"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";

type Props = {
  open: boolean;
  onClose: () => void;
  productText?: string;
};

export function RequestLoggedModal({ open, onClose, productText }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            aria-label="Cerrar"
            className="fixed inset-0 z-[65] bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed left-1/2 top-1/2 z-[70] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f3f1f1] shadow-2xl"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-black">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 11l2 2 4-4" />
                    <path d="M7 4h10v16H7z" />
                  </svg>
                </span>
                Anotado
              </div>
              <MotionButton
                tone="ghost"
                className="h-9 px-3 !text-black/75 hover:!bg-black/5"
                onClick={onClose}
              >
                Cerrar
              </MotionButton>
            </div>

            <div className="p-5">
              <div className="text-sm font-semibold text-black/80">
                Todavía no vendemos este tipo de producto, pero ya lo sumamos a los solicitados.
              </div>
              {productText ? (
                <div className="mt-3 rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm font-semibold text-black">
                  “{productText}”
                </div>
              ) : null}
              <div className="mt-4 text-xs text-black/60">
                Gracias por avisarnos :)
              </div>

              <MotionButton className="mt-4 h-11 w-full" onClick={onClose}>
                Listo
              </MotionButton>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

