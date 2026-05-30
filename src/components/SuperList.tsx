"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { normalizeToken } from "@/lib/normalize";
import { searchProductsByToken } from "@/lib/products";
import { useCartStore } from "@/store/cart";
import { formatArs } from "@/lib/format";
import { StrikeThrough } from "@/components/StrikeThrough";

export type SuperItem = {
  id: string;
  raw: string;
  token: string;
  added: boolean;
  noResults?: boolean;
  purchased?: { productId: string; variant: "unit" | "pack"; qty: number };
  offer?: boolean;
};

type Props = {
  items: SuperItem[];
  activeId: string | null;
  onAddItem: (raw: string) => void;
  onSelect: (id: string) => void;
  onMarkAdded: (id: string) => void;
  onClear: () => void;
  onFocusOptions: () => void;
  onEditPurchased: (id: string) => void;
  onOpenOffers: () => void;
  onRemoveItem: (id: string) => void;
};

function jitter(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const n = Math.abs(hash % 7);
  return (n - 3) * 0.4;
}

function useStrikeRange(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [range, setRange] = useState<{ from: number; to: number }>({
    from: 0,
    to: 100,
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const rightReservePx = 118;
    const leftPadPx = 8;

    const recalc = () => {
      const cw = container.clientWidth || 1;
      const tw = text.getBoundingClientRect().width;
      const fromPx = Math.min(cw, Math.max(0, tw + leftPadPx));
      const toPx = Math.max(fromPx, cw - rightReservePx);
      setRange({
        from: (fromPx / cw) * 100,
        to: (toPx / cw) * 100,
      });
    };

    recalc();
    const ro = new ResizeObserver(() => recalc());
    ro.observe(container);
    ro.observe(text);
    return () => ro.disconnect();
  }, [active]);

  return { containerRef, textRef, range };
}

export function SuperList({
  items,
  activeId,
  onAddItem,
  onSelect,
  onMarkAdded,
  onClear,
  onFocusOptions,
  onEditPurchased,
  onOpenOffers,
  onRemoveItem,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);
  const [pending, setPending] = useState<{ raw: string; suggestions: string[] } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const total = useCartStore((s) =>
    s.items.reduce((acc, i) => acc + i.price * i.qty, 0),
  );

  const updateFades = () => {
    const el = listScrollRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight - el.clientHeight > 2;
    if (!canScroll) {
      setFadeTop(false);
      setFadeBottom(false);
      return;
    }
    setFadeTop(el.scrollTop > 2);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => {
    queueMicrotask(() => updateFades());
  }, [items.length]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-col rounded-3xl border border-border bg-paper p-4 shadow-sm">
        <div className="relative pb-3">
          <div className="text-center text-base font-semibold tracking-tight text-black/85 sm:text-lg">
            Mi lista
          </div>
          <button
            type="button"
            onClick={() => {
              setValue("");
              onClear();
            }}
            className="absolute right-0 top-0 rounded-xl px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40"
          >
            Limpiar
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const raw = value.trim();
            if (!raw) return;

            const token = normalizeToken(raw);
            if (token && items.some((i) => i.token === token)) {
              setNotice("Ese ítem ya está en la lista.");
              setValue("");
              queueMicrotask(() => inputRef.current?.focus());
              return;
            }

            setChecking(true);
            try {
              const res = await searchProductsByToken(raw);
              if (res.products.length > 0) {
                setPending(null);
                onAddItem(raw);
                setValue("");
                queueMicrotask(() => inputRef.current?.focus());
                return;
              }

              if (res.suggestions.length > 0) {
                setPending({ raw, suggestions: res.suggestions });
                return;
              }

              setPending(null);
              onAddItem(raw);
              setValue("");
              queueMicrotask(() => inputRef.current?.focus());
            } finally {
              setChecking(false);
            }
          }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (pending) setPending(null);
            }}
            placeholder="que necesitas?"
            className="w-full rounded-2xl border border-border bg-white/85 px-4 py-3 text-base text-black shadow-[0_10px_18px_rgba(0,0,0,0.08)] outline-none ring-0 placeholder:text-black/40 focus:border-black/25"
          />
        </form>

        {pending ? (
          <div className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
            <div className="text-xs font-semibold text-black/70">
              Quizás quisiste buscar:
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pending.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const token = normalizeToken(s);
                    if (token && items.some((i) => i.token === token)) {
                      setPending(null);
                      setNotice("Ese ítem ya está en la lista.");
                      setValue("");
                      queueMicrotask(() => inputRef.current?.focus());
                      return;
                    }
                    setPending(null);
                    onAddItem(s);
                    setValue("");
                    queueMicrotask(() => inputRef.current?.focus());
                  }}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-black/80 hover:bg-black/5"
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-full px-3 py-1 text-xs font-semibold text-black/55 hover:bg-black/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {checking ? (
          <div className="mt-2 text-xs font-semibold text-black/45">Buscando…</div>
        ) : null}

        {notice ? (
          <div className="mt-2 text-xs font-semibold text-red-700">{notice}</div>
        ) : null}

        <div className="relative mt-4 flex-1">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-4 text-sm text-foreground/70">
              Empezá escribiendo un producto (una palabra) y apretá Enter.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="relative">
                <motion.div
                  ref={listScrollRef}
                  layout
                  className="no-scrollbar max-h-[340px] overflow-auto pr-1 [scrollbar-gutter:stable] md:max-h-[520px]"
                  onScroll={updateFades}
                >
                  <motion.ul layout className="flex flex-col gap-1 pb-3">
                    {items.map((it) => (
                      <SuperListRow
                        key={it.id}
                        item={it}
                        active={it.id === activeId}
                        onSelect={onSelect}
                        onFocusOptions={onFocusOptions}
                        onEditPurchased={onEditPurchased}
                        onMarkAdded={onMarkAdded}
                        onRemoveItem={onRemoveItem}
                      />
                    ))}
                  </motion.ul>
                </motion.div>

                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 top-0 h-8"
                  initial={false}
                  animate={{ opacity: fadeTop ? 1 : 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{
                    background:
                      "linear-gradient(to bottom, color-mix(in srgb, #fffdfb 92%, transparent), transparent)",
                  }}
                />
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-10"
                  initial={false}
                  animate={{ opacity: fadeBottom ? 1 : 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{
                    background:
                      "linear-gradient(to top, color-mix(in srgb, #fffdfb 92%, transparent), transparent)",
                  }}
                />
              </div>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-white/70 px-4 py-3 text-center font-hand text-[22px] leading-6 text-black">
          TOTAL: <span className="font-semibold">{formatArs(total)}</span>
        </div>

        <button
          type="button"
          onClick={onOpenOffers}
          className="mt-4 w-full rounded-2xl border border-black/10 bg-[#F4B61E] px-4 py-3 text-center text-sm font-black tracking-tight text-black shadow-[0_10px_18px_rgba(0,0,0,0.10)] hover:brightness-[0.98] active:brightness-[0.96]"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <span aria-hidden="true" className="text-[14px] leading-none">
              ✦
            </span>
            <span>Ofertas del Dia!</span>
            <span aria-hidden="true" className="text-[14px] leading-none">
              ✦
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function SuperListRow({
  item,
  active,
  onSelect,
  onFocusOptions,
  onEditPurchased,
  onMarkAdded,
  onRemoveItem,
}: {
  item: SuperItem;
  active: boolean;
  onSelect: (id: string) => void;
  onFocusOptions: () => void;
  onEditPurchased: (id: string) => void;
  onMarkAdded: (id: string) => void;
  onRemoveItem: (id: string) => void;
}) {
  const rot = jitter(item.id);
  const markRot = (rot * 0.4).toFixed(2);
  const base = normalizeToken(item.raw);
  const show = base || item.raw;
  const { containerRef, textRef, range } = useStrikeRange(item.added);
  const x = useMotionValue(0);
  const swipeLeftPx = -86;
  const isDraggingRef = useRef(false);
  const reveal = useTransform(x, [0, swipeLeftPx], [0, 1]);

  return (
    <motion.li layout className="relative overflow-hidden rounded-2xl">
      {/* Swipe reveal background (gradual) */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end rounded-2xl px-3"
        style={{ opacity: reveal }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-red-600/55 via-red-600/25 to-transparent" />
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm"
          aria-label={`Eliminar ${show}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 text-red-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: swipeLeftPx, right: 0 }}
        dragElastic={0.12}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={(_, info) => {
          // allow click again
          queueMicrotask(() => {
            isDraggingRef.current = false;
          });
          // If user swipes far enough, delete.
          if (info.offset.x < swipeLeftPx * 0.7 || info.velocity.x < -700) {
            onRemoveItem(item.id);
            return;
          }
          // Snap back
          x.set(0);
        }}
        className={[
          "relative rounded-2xl border px-4 py-3",
          active
            ? "border-brand/25 bg-surface"
            : "border-border bg-surface/80 hover:bg-surface",
        ].join(" ")}
      >
        <motion.button
          type="button"
          onClick={() => {
            if (isDraggingRef.current) return;
            onSelect(item.id);
            if (item.added && item.purchased) {
              onEditPurchased(item.id);
              return;
            }
            if (!item.added && !item.noResults) {
              onFocusOptions();
            }
          }}
          className="relative w-full text-left"
          style={{ transform: `rotate(${rot}deg)` }}
          whileTap={{ scale: 0.99 }}
        >
          <span
            aria-hidden="true"
            className={[
              "absolute left-3 top-1/2 -translate-y-1/2",
              "inline-flex h-6 w-6 items-center justify-center rounded-md border",
              item.purchased
                ? "border-green-600 bg-green-600 text-white"
                : item.noResults
                  ? "hidden"
                  : "border-black/25 bg-white/70 text-transparent",
            ].join(" ")}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>

          <div ref={containerRef} className="relative pl-10 pr-28">
            <div className="min-w-0 font-hand text-[22px] leading-6 text-black uppercase">
              <span ref={textRef} className="relative z-0 inline-block">
                {item.offer ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-[-6px] bottom-[0.05em] z-[-1] h-[0.9em] rounded-xl bg-[#FFF200]/75 blur-[0.2px]"
                    style={{ transform: `rotate(${markRot}deg)` }}
                  />
                ) : null}
                <span className={item.added ? "opacity-45" : ""}>{show}</span>
              </span>
              <StrikeThrough
                active={Boolean(item.noResults)}
                from={range.from}
                to={range.to}
                className={item.noResults ? "text-red-600" : undefined}
                offsetYClassName={item.noResults ? "-translate-y-[0.95rem]" : undefined}
              />
            </div>
          </div>

          {!item.added ? (
            <span
              className={[
                "absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold",
                item.noResults
                  ? "right-3 cursor-default text-red-600/70"
                  : "right-3 text-black/35 hover:text-black/65",
              ].join(" ")}
            >
              {item.noResults ? "muy pronto" : "elegi una opcion"}
            </span>
          ) : null}

          {item.added ? (
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-green-600">
              {item.purchased ? (
                <span className="text-[11px] font-semibold uppercase text-black/55">
                  x{item.purchased.qty}{" "}
                  {item.purchased.variant === "unit" ? "unid" : "cajas"}
                </span>
              ) : null}
            </span>
          ) : null}

          {!item.added ? <span className="sr-only">Pendiente</span> : null}
        </motion.button>
      </motion.div>

      {!item.added && active ? (
        <div className="sr-only">
          <button type="button" onClick={() => onMarkAdded(item.id)}>
            Marcar agregado
          </button>
        </div>
      ) : null}
    </motion.li>
  );
}
