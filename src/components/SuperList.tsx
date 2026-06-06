"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { normalizeToken } from "@/lib/normalize";
import {
  getProductById,
  type SearchPromptSuggestion,
  getSearchPromptSuggestions,
  getTrendingSearchPrompts,
} from "@/lib/products";
import { useCartStore } from "@/store/cart";
import { formatArs } from "@/lib/format";
import { StrikeThrough } from "@/components/StrikeThrough";

export type Selection = {
  id: string; // `${productId}:${variant}`
  productId: string;
  variant: "unit" | "pack";
  qty: number;
};

export type SuperItem = {
  id: string;
  raw: string;
  token: string;
  source?: "list" | "category" | "offer";
  added: boolean;
  noResults?: boolean;
  selections?: Selection[];
  offer?: boolean;
};

type Props = {
  items: SuperItem[];
  activeId: string | null;
  onAddItem: (
    raw: string,
    opts?: {
      noResults?: boolean;
      token?: string;
      source?: SuperItem["source"];
    },
  ) => void;
  onSelect: (id: string) => void;
  onMarkAdded: (id: string) => void;
  onClear: () => void;
  onFocusOptions: () => void;
  onEditSelection: (itemId: string, selectionId: string) => void;
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
  onEditSelection,
  onOpenOffers,
  onRemoveItem,
}: Props) {
  const [value, setValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [quickSuggestions, setQuickSuggestions] = useState<SearchPromptSuggestion[]>([]);
  const [unitsPerSelection, setUnitsPerSelection] = useState<Record<string, number>>(
    {},
  );
  const deferredValue = useDeferredValue(value);
  const trendingExamples = getTrendingSearchPrompts();
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

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = deferredValue.trim();

    if (!query) return () => {
      cancelled = true;
    };

    (async () => {
      const suggestions = await getSearchPromptSuggestions(query);
      if (cancelled) return;
      setQuickSuggestions(suggestions);
    })();

    return () => {
      cancelled = true;
    };
  }, [deferredValue]);

  useEffect(() => {
    let cancelled = false;
    const needed = new Map<string, { productId: string; variant: "unit" | "pack" }>();
    for (const it of items) {
      for (const s of it.selections ?? []) {
        if (!s?.id || !s.productId) continue;
        if (unitsPerSelection[s.id] === undefined) {
          needed.set(s.id, { productId: s.productId, variant: s.variant });
        }
      }
    }
    if (needed.size === 0) return;

    (async () => {
      const entries = Array.from(needed.entries());
      const unitUpdates: Record<string, number> = {};
      for (const [id, meta] of entries) {
        const p = await getProductById(meta.productId);
        if (!p) continue;
        unitUpdates[id] =
          meta.variant === "pack" ? Math.max(1, p.pack?.qty ?? 1) : 1;
      }
      if (cancelled) return;
      if (Object.keys(unitUpdates).length === 0) return;
      setUnitsPerSelection((prev) => ({ ...prev, ...unitUpdates }));
    })();

    return () => {
      cancelled = true;
    };
  }, [items, unitsPerSelection]);

  const commitItem = (
    raw: string,
    opts?: {
      openOptions?: boolean;
      restoreFocus?: boolean;
      source?: SuperItem["source"];
    },
  ) => {
    const cleaned = raw.trim();
    if (!cleaned) return false;

    const token = normalizeToken(cleaned);
    if (token && items.some((i) => i.token === token)) {
      setNotice("Ese ítem ya está en la lista.");
      setValue("");
      setQuickSuggestions([]);
      if (opts?.restoreFocus !== false) {
        queueMicrotask(() => inputRef.current?.focus());
      }
      return false;
    }

    onAddItem(cleaned, { source: opts?.source });
    setValue("");
    setQuickSuggestions([]);
    if (opts?.openOptions) onFocusOptions();
    if (opts?.restoreFocus !== false) {
      queueMicrotask(() => inputRef.current?.focus());
    }
    return true;
  };

  const showQuickSuggestions =
    inputFocused && quickSuggestions.length > 0 && value.trim().length > 0;

  return (
    <div className="flex flex-col">
      <div
        className="flex min-h-[50vh] max-h-[78vh] flex-col rounded-3xl border border-border paper-bloc shadow-sm md:max-h-[72vh]"
        style={{
          padding: "var(--paper-pad)",
        }}
      >
        <div className="relative pb-3">
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            commitItem(value);
          }}
        >
          <div className="relative mx-auto w-full max-w-[92%] sm:max-w-[88%]">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => {
                const nextValue = e.target.value;
                setValue(nextValue);
                if (!nextValue.trim()) setQuickSuggestions([]);
              }}
              onFocus={() => {
                if (blurTimeoutRef.current) {
                  window.clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                setInputFocused(true);
              }}
              onBlur={() => {
                blurTimeoutRef.current = window.setTimeout(() => {
                  setInputFocused(false);
                }, 120);
              }}
              placeholder={inputFocused ? "" : "¿Qué necesitás?"}
              className={[
                "app-input w-full rounded-2xl py-3.5 text-base text-foreground shadow-[0_18px_34px_rgba(29,53,87,0.14),0_6px_14px_rgba(255,255,255,0.72)] outline-none ring-2 ring-[rgba(69,123,157,0.10)] focus:border-[#457B9D]/50 focus:ring-[rgba(69,123,157,0.18)]",
                value.trim().length > 0 || inputFocused
                  ? "pl-4 pr-14 text-left"
                  : "px-4 text-center placeholder:text-center",
              ].join(" ")}
            />
            {value.trim().length > 0 ? (
              <button
                type="submit"
                aria-label="Agregar"
                className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#FF0000] text-white shadow-[0_10px_18px_rgba(255,0,0,0.22)] hover:brightness-[0.98] active:brightness-[0.96]"
              >
                <span className="text-xl leading-none">+</span>
              </button>
            ) : null}
            <AnimatePresence initial={false}>
              {showQuickSuggestions ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="quick-suggestions absolute inset-x-0 top-[calc(100%+0.7rem)] z-20"
                >
                  <div className="quick-suggestions__head">
                    Sugerencias para escribir más rápido
                  </div>
                  <div className="quick-suggestions__list">
                    {quickSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.kind}:${suggestion.value}`}
                        type="button"
                        className={[
                          "quick-suggestion-tag",
                          suggestion.kind === "did_you_mean" ? "quick-suggestion-tag--hint" : "",
                        ].join(" ")}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          commitItem(suggestion.value, {
                            openOptions: true,
                            restoreFocus: false,
                          });
                          setInputFocused(false);
                          inputRef.current?.blur();
                        }}
                      >
                        {suggestion.kind === "did_you_mean" ? (
                          <span>
                            <span className="quick-suggestion-chip__prefix">Quisiste decir </span>
                            <span>{suggestion.label.replace(/^Quisiste decir\s+/i, "")}</span>
                          </span>
                        ) : (
                          <>
                            <span className="quick-suggestion-chip__prefix">
                              {suggestion.label.slice(0, value.trim().length)}
                            </span>
                            <span>{suggestion.label.slice(value.trim().length)}</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </form>

        {notice ? (
          <div className="mt-2 text-xs font-semibold text-brand">{notice}</div>
        ) : null}

        <div className="relative mt-4 flex-1">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="empty-search-showcase rounded-[28px] border border-dashed border-border bg-surface/60 p-4 text-sm text-foreground/70"
            >
              <div className="empty-search-showcase__copy">
                <div className="empty-search-showcase__title">Sugerencias</div>
              </div>

              <div className="empty-search-showcase__cloud" aria-label="Ejemplos más buscados">
                {trendingExamples.map((example, index) => (
                  <button
                    key={example}
                    type="button"
                    className="empty-search-showcase__chip"
                    style={
                      {
                        "--float-delay": `${index * 0.45}s`,
                        "--float-duration": `${5.4 + index * 0.45}s`,
                        "--float-offset": `${10 + (index % 3) * 4}px`,
                        "--float-rotate": `${index % 2 === 0 ? "1.4deg" : "-1.2deg"}`,
                      } as CSSProperties
                    }
                    onClick={() => {
                      commitItem(example, { openOptions: true });
                      setInputFocused(false);
                      inputRef.current?.blur();
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
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
                        onOpenOffers={onOpenOffers}
                        onEditSelection={onEditSelection}
                        onMarkAdded={onMarkAdded}
                        onRemoveItem={onRemoveItem}
                        unitsPerSelection={unitsPerSelection}
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
                      "linear-gradient(to bottom, color-mix(in srgb, var(--paper-bg) 92%, transparent), transparent)",
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
                      "linear-gradient(to top, color-mix(in srgb, var(--paper-bg) 92%, transparent), transparent)",
                  }}
                />
              </div>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-2xl border border-border bg-white/82 px-4 py-3 text-center font-hand text-[20px] leading-5 text-foreground">
            TOTAL: <span className="font-semibold">{formatArs(total)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setValue("");
              setQuickSuggestions([]);
              onClear();
            }}
            className="rounded-2xl border border-border bg-white/82 px-4 py-3 text-center text-xs font-semibold text-foreground/70 hover:bg-[rgba(69,123,157,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#457B9D]"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

function SuperListRow({
  item,
  active,
  onSelect,
  onFocusOptions,
  onOpenOffers,
  onEditSelection,
  onMarkAdded,
  onRemoveItem,
  unitsPerSelection,
}: {
  item: SuperItem;
  active: boolean;
  onSelect: (id: string) => void;
  onFocusOptions: () => void;
  onOpenOffers: () => void;
  onEditSelection: (itemId: string, selectionId: string) => void;
  onMarkAdded: (id: string) => void;
  onRemoveItem: (id: string) => void;
  unitsPerSelection: Record<string, number>;
}) {
  const rot = jitter(item.id);
  const markRot = (rot * 0.4).toFixed(2);
  const base = normalizeToken(item.raw);
  const show = base || item.raw;
  const { containerRef, textRef, range } = useStrikeRange(Boolean(item.noResults));
  const x = useMotionValue(0);
  const swipeLeftPx = -86;
  const isDraggingRef = useRef(false);
  const reveal = useTransform(x, [0, swipeLeftPx], [0, 1]);
  const selections = item.selections ?? [];
  const hasSelections = selections.length > 0;
  const brandsCount = selections.length;
  const totalUnits = selections.reduce((acc, s) => {
    const per = unitsPerSelection[s.id] ?? (s.variant === "pack" ? 1 : 1);
    return acc + Math.max(0, s.qty) * Math.max(1, per);
  }, 0);

  return (
    <motion.li layout className="relative overflow-hidden rounded-2xl">
      {/* Swipe reveal background (gradual) */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end rounded-2xl px-3"
        style={{ opacity: reveal }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-[rgba(230,57,70,0.45)] via-[rgba(230,57,70,0.22)] to-transparent" />
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 shadow-sm"
          aria-label={`Eliminar ${show}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 text-brand"
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
            if (item.offer) {
              onOpenOffers();
              return;
            }
            if (!item.added && !item.noResults) {
              onFocusOptions();
              return;
            }
            if (hasSelections && !item.noResults) {
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
              hasSelections
                ? "border-[#1D3557] bg-[#1D3557] text-white"
                : item.noResults
                  ? "hidden"
                  : "border-[rgba(29,53,87,0.24)] bg-white/82 text-transparent",
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
            <div className="min-w-0 font-hand text-[20px] leading-5 text-foreground uppercase">
              <span ref={textRef} className="relative z-0 inline-block">
                {item.offer ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-[-6px] bottom-[0.05em] z-[-1] h-[0.9em] rounded-xl bg-[rgba(230,57,70,0.22)] blur-[0.2px]"
                    style={{ transform: `rotate(${markRot}deg)` }}
                  />
                ) : null}
                <span className={item.added ? "opacity-45" : ""}>{show}</span>
                <StrikeThrough
                  active={Boolean(item.noResults)}
                  from={0}
                  to={100}
                  className={item.noResults ? "text-brand" : undefined}
                  offsetYClassName={item.noResults ? "top-[0.62em] -translate-y-1/2" : undefined}
                />
              </span>
            </div>

            {brandsCount > 1 ? (
              <div className="mt-2 text-[11px] font-semibold text-foreground/55">
                {brandsCount} marcas
              </div>
            ) : null}
          </div>

          {!item.added ? (
            <span
              className={[
                "absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold",
                item.noResults
                  ? "right-3 cursor-default text-brand/75"
                  : "right-3 text-foreground/40 hover:text-foreground/70",
              ].join(" ")}
            >
              {item.noResults ? "muy pronto" : "elegi una opcion"}
            </span>
          ) : null}

          {item.added ? (
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-[#457B9D]">
              <span className="text-[11px] font-semibold uppercase text-foreground/55">
                {hasSelections ? `x${totalUnits} unid` : ""}
              </span>
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

