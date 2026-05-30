"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatArs } from "@/lib/format";
import { MotionButton } from "@/components/MotionButton";
import { useCartStore } from "@/store/cart";

function CartContent({ onContinue }: { onContinue: () => void }) {
  const items = useCartStore((s) => s.items);
  const decItem = useCartStore((s) => s.decItem);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-black">Carrito</div>
        <MotionButton
          tone="ghost"
          className="h-9 px-3 !text-black/80 hover:!bg-black/5"
          onClick={() => clear()}
          disabled={items.length === 0}
        >
          Vaciar
        </MotionButton>
      </div>

      <div className="no-scrollbar flex-1 overflow-auto p-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/70 p-4 text-sm text-black/70">
            Todavía no agregaste nada.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="rounded-2xl border border-border bg-white/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-black">
                      {i.name}
                    </div>
                    <div className="text-xs text-black/70">
                      {i.label} · {formatArs(i.price)}
                    </div>
                  </div>
                  <MotionButton
                    tone="ghost"
                    className="h-8 px-2 text-xs !text-black/75 hover:!bg-black/5"
                    onClick={() => removeItem(i.id)}
                  >
                    Quitar
                  </MotionButton>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-black/70">
                    Subtotal:{" "}
                    <span className="font-semibold text-black">
                      {formatArs(i.price * i.qty)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 px-0"
                      onClick={() => decItem(i.id)}
                      aria-label="Restar"
                    >
                      −
                    </MotionButton>
                    <div className="w-8 text-center text-sm font-semibold text-black">
                      {i.qty}
                    </div>
                    <MotionButton
                      tone="soft"
                      className="h-8 w-8 px-0"
                      onClick={() =>
                        addItem({
                          id: i.id,
                          productId: i.productId,
                          name: i.name,
                          variant: i.variant,
                          label: i.label,
                          price: i.price,
                        }, 1)
                      }
                      aria-label="Sumar"
                    >
                      +
                    </MotionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 pb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-black/70">Total</div>
          <div className="text-lg font-semibold text-black">
            {formatArs(total)}
          </div>
        </div>
        <MotionButton
          className="mt-4 h-11 w-full"
          disabled={items.length === 0}
          onClick={onContinue}
        >
          Continuar
        </MotionButton>
      </div>
    </div>
  );
}

export function CartPanel() {
  const open = useCartStore((s) => s.open);
  const closeCart = useCartStore((s) => s.closeCart);
  const itemsCount = useCartStore((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [constructionOpen, setConstructionOpen] = useState(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-10 left-1/2 z-40 -translate-x-1/2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/15"
        onClick={() => useCartStore.getState().toggleCart()}
      >
        Carrito · {itemsCount}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              aria-label="Cerrar carrito"
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCart}
            />

            {isMobile ? (
              <motion.aside
                className="fixed bottom-0 left-0 right-0 z-50 h-[78vh] overflow-hidden rounded-t-3xl bg-gradient-to-b from-[#f7f4f4] to-[#efebeb] shadow-2xl"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
              >
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300" />
                <CartContent onContinue={() => setConstructionOpen(true)} />
              </motion.aside>
            ) : (
              <motion.aside
                className="fixed right-4 top-4 z-50 h-[calc(100vh-2rem)] w-[380px] overflow-hidden rounded-3xl bg-gradient-to-b from-[#f7f4f4] to-[#efebeb] shadow-2xl"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 30, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 45 }}
              >
                <CartContent onContinue={() => setConstructionOpen(true)} />
              </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {constructionOpen ? (
          <>
            <motion.button
              aria-label="Cerrar"
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConstructionOpen(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-[70] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-[#f7f4f4] shadow-2xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="text-sm font-semibold text-black">En construcción</div>
                <div className="mt-1 text-xs text-black/70">
                  Todavía estamos armando el checkout. Muy pronto vas a poder finalizar tu pedido.
                </div>
              </div>
              <div className="px-5 py-4">
                <MotionButton className="h-11 w-full" onClick={() => setConstructionOpen(false)}>
                  Entendido
                </MotionButton>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
