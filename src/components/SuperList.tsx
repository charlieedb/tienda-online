"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { normalizeToken } from "@/lib/normalize";
import {
  getProductById,
  type SearchPromptSuggestion,
  getSearchPromptSuggestions,
  getTrendingSearchPrompts,
} from "@/lib/products";
import { getCartItemPricing, useCartStore } from "@/store/cart";
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
  const [popularSuggestionsPinned, setPopularSuggestionsPinned] = useState(false);
  const [popularSuggestionsDismissed, setPopularSuggestionsDismissed] = useState(false);
  const [unitsPerSelection, setUnitsPerSelection] = useState<Record<string, number>>(
    {},
  );
  const deferredValue = useDeferredValue(value);
  const trendingExamples = getTrendingSearchPrompts();
  const trimmedValue = value.trim();
  const total = useCartStore((s) =>
    s.items.reduce((acc, i) => acc + getCartItemPricing(i).total, 0),
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
    if (items.length === 0) {
      setPopularSuggestionsPinned(false);
      setPopularSuggestionsDismissed(false);
    }
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
    if (opts?.openOptions) {
      inputRef.current?.blur();
      onFocusOptions();
    }
    if (opts?.restoreFocus !== false) {
      queueMicrotask(() => inputRef.current?.focus());
    }
    return true;
  };

  const shouldShowPopularSuggestions =
    trimmedValue.length === 0 &&
    !popularSuggestionsDismissed &&
    (items.length === 0 || popularSuggestionsPinned);

  const visibleSuggestions =
    trimmedValue.length > 0
      ? quickSuggestions.slice(0, 6).map((suggestion) => ({
          key: `${suggestion.kind}:${suggestion.value}`,
          value: suggestion.value,
          label:
            suggestion.kind === "did_you_mean"
              ? suggestion.label
              : suggestion.label,
          accent:
            suggestion.kind === "did_you_mean"
              ? "Quisiste decir"
              : "+",
          hint: suggestion.kind === "did_you_mean",
          added: items.some((item) => item.token === normalizeToken(suggestion.value)),
          opensOptions: true,
          popular: false,
        }))
      : shouldShowPopularSuggestions
        ? trendingExamples.slice(0, 6).map((example) => ({
            key: `trend:${example}`,
            value: example,
            label: example,
            accent: "+",
            hint: false,
            added: items.some((item) => item.token === normalizeToken(example)),
            opensOptions: false,
            popular: true,
          }))
        : [];
  const showSuggestionsPanel = inputFocused && visibleSuggestions.length > 0;

  return (
    <div className="flex flex-col">
      <div
        className="flex min-h-[50vh] max-h-[78vh] flex-col rounded-[34px] border border-white/70 paper-bloc shadow-[0_30px_70px_rgba(29,53,87,0.12)] md:max-h-[72vh]"
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
                if (items.length === 0) {
                  setPopularSuggestionsDismissed(false);
                }
                setInputFocused(true);
              }}
              onBlur={() => {
                blurTimeoutRef.current = window.setTimeout(() => {
                  if (popularSuggestionsPinned && trimmedValue.length === 0) {
                    setPopularSuggestionsPinned(false);
                    setPopularSuggestionsDismissed(true);
                  }
                  setInputFocused(false);
                }, 120);
              }}
              placeholder={inputFocused ? "" : "¿Qué necesitás?"}
              className={[
                "app-input w-full rounded-[26px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.94))] py-3.5 text-base text-foreground shadow-[0_22px_40px_rgba(29,53,87,0.12),0_8px_16px_rgba(255,255,255,0.78)] outline-none ring-1 ring-[rgba(69,123,157,0.08)] focus:border-[#457B9D]/45 focus:ring-[rgba(69,123,157,0.16)]",
                value.trim().length > 0 || inputFocused
                  ? "pl-4 pr-14 text-left"
                  : "px-4 text-center placeholder:text-center",
              ].join(" ")}
            />
            {value.trim().length > 0 ? (
              <button
                type="submit"
                aria-label="Agregar"
                className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#ff0000,#d70000)] text-white shadow-[0_14px_22px_rgba(255,0,0,0.22)] hover:brightness-[0.99] active:brightness-[0.96]"
              >
                <span className="text-xl leading-none">+</span>
              </button>
            ) : null}
            <AnimatePresence initial={false}>
              {showSuggestionsPanel ? (
                <motion.div
                  key="suggestions-panel"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.985 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="quick-suggestions quick-suggestions--floating absolute inset-x-0 top-[calc(100%+0.55rem)] z-20"
                >
                  <div className="quick-suggestions__grid" aria-label="Sugerencias rápidas">
                    {visibleSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        className={[
                          "quick-suggestion-mini",
                          suggestion.hint ? "quick-suggestion-mini--hint" : "",
                          suggestion.added ? "quick-suggestion-mini--added" : "",
                        ].join(" ")}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (suggestion.popular) {
                            setPopularSuggestionsPinned(true);
                          }
                          commitItem(suggestion.value, {
                            openOptions: suggestion.opensOptions,
                            restoreFocus: !suggestion.opensOptions,
                          });
                          if (suggestion.opensOptions) {
                            setInputFocused(false);
                            inputRef.current?.blur();
                          }
                        }}
                      >
                        <span className="quick-suggestion-mini__plus">
                          {suggestion.added ? "✓" : suggestion.accent}
                        </span>
                        <span className="quick-suggestion-mini__label">{suggestion.label}</span>
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
            <div className="flex h-full min-h-[180px] items-center justify-center rounded-[28px] border border-dashed border-[rgba(69,123,157,0.12)] bg-white/16">
              <div className="text-center text-sm text-foreground/42">
                La listita aparece acá.
              </div>
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
          <div className="flex-1 rounded-2xl border border-[#457B9D] bg-[#457B9D] px-4 py-3 text-center text-[17px] font-semibold leading-5 tracking-[-0.02em] text-white shadow-[0_14px_28px_rgba(69,123,157,0.24)]">
            TOTAL: <span className="font-bold">{formatArs(total)}</span>
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
            <div className="min-w-0 text-[17px] font-semibold leading-5 tracking-[-0.02em] text-foreground uppercase">
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
                "absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-end text-[11px] font-semibold leading-tight",
                item.noResults
                  ? "cursor-default text-brand/75"
                  : "text-foreground/40 hover:text-foreground/70",
              ].join(" ")}
            >
              {item.noResults ? (
                "muy pronto"
              ) : (
                <>
                  <span>elegi una opcion</span>
                  <span className="mt-0.5 text-[9px] font-normal text-[#E63946]">
                    desliza para eliminar
                  </span>
                </>
              )}
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

