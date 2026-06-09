"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { formatArs } from "@/lib/format";
import type { Product } from "@/lib/products";
import { MotionButton } from "@/components/MotionButton";

type Props = {
  product: Product;
  onSelect: () => void;
  tag?: "OFERTA";
  addedQty?: number | null;
  tone?: "default" | "offers";
  compact?: boolean;
};

type ImageCacheEntry = {
  thumbLoaded: boolean;
  fullLoaded: boolean;
  failedUrls: string[];
};

const imageStateCache = new Map<string, ImageCacheEntry>();
const thumbRepairRequested = new Set<string>();

function getThumbRepairUrl(productId: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
  if (!projectId) return null;
  const safeId = productId.replaceAll("/", "_");
  return `https://us-central1-${projectId}.cloudfunctions.net/ensureProductThumb?code=${encodeURIComponent(safeId)}`;
}

function requestThumbRepair(productId: string) {
  if (typeof window === "undefined") return;
  if (thumbRepairRequested.has(productId)) return;
  const url = getThumbRepairUrl(productId);
  if (!url) return;
  thumbRepairRequested.add(productId);
  window.fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Best effort only: if it fails, we'll keep showing the full image and try again in a future session.
  });
}

function getCachedImageState(productId: string): ImageCacheEntry {
  return imageStateCache.get(productId) ?? { thumbLoaded: false, fullLoaded: false, failedUrls: [] };
}

function setCachedImageState(productId: string, patch: Partial<ImageCacheEntry>) {
  const next = { ...getCachedImageState(productId), ...patch };
  imageStateCache.set(productId, next);
  return next;
}

function addFailedUrl(productId: string, url: string) {
  const prev = getCachedImageState(productId);
  if (!url || prev.failedUrls.includes(url)) return prev;
  return setCachedImageState(productId, {
    failedUrls: [...prev.failedUrls, url],
  });
}

function ProductCardInner({
  product,
  onSelect,
  tag,
  addedQty = null,
  tone = "default",
  compact = false,
}: Props) {
  const isOut = product.active === false;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "";
  const cardRef = useRef<HTMLDivElement | null>(null);

  const withStorageSafeFilename = (value: string) => {
    const safeId = product.id.replaceAll("/", "_");
    const encodedSafeId = encodeURIComponent(safeId);
    return value
      .replace(new RegExp(`${encodeURIComponent(product.id)}(?=\\.jpg)`, "g"), encodedSafeId)
      .replace(new RegExp(`${product.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\.jpg)`, "g"), safeId);
  };

  const imageCandidates = useMemo(() => {
    const u = String(product.imageUrl ?? "").trim();
    const thumbCandidates: string[] = [];
    const fullCandidates: string[] = [];

    const addUnique = (list: string[], value: string) => {
      const next = value.trim();
      if (!next || list.includes(next)) return;
      list.push(next);
    };

    const toFullUrl = (value: string) =>
      value
        .replace("fotosProductosThumb%2F", "fotosProductos%2F")
        .replace("/fotosProductosThumb/", "/fotosProductos/");

    if (u) {
      addUnique(thumbCandidates, u);
      addUnique(fullCandidates, toFullUrl(u));
      if (product.id.includes("/")) {
        addUnique(thumbCandidates, withStorageSafeFilename(u));
        addUnique(fullCandidates, withStorageSafeFilename(toFullUrl(u)));
      }
    }

    if (storageBucket) {
      const safeId = product.id.replaceAll("/", "_");
      addUnique(
        thumbCandidates,
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(`fotosProductosThumb/${safeId}.jpg`)}?alt=media`,
      );
      addUnique(
        fullCandidates,
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(`fotosProductos/${safeId}.jpg`)}?alt=media`,
      );
    }

    return { thumbCandidates, fullCandidates };
  }, [product.id, product.imageUrl, storageBucket]);

  const initialCache = getCachedImageState(product.id);
  const thumbIndexRef = useRef(0);
  const fullIndexRef = useRef(0);
  const [fullActivated, setFullActivated] = useState(false);
  const [thumbSrc, setThumbSrc] = useState<string | null>(imageCandidates.thumbCandidates[0] ?? null);
  const [fullSrc, setFullSrc] = useState<string | null>(imageCandidates.fullCandidates[0] ?? null);
  const [thumbLoaded, setThumbLoaded] = useState(initialCache.thumbLoaded);
  const [fullLoaded, setFullLoaded] = useState(initialCache.fullLoaded);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const cache = getCachedImageState(product.id);
    const nextThumbIndex = imageCandidates.thumbCandidates.findIndex(
      (candidate) => !cache.failedUrls.includes(candidate),
    );
    const nextFullIndex = imageCandidates.fullCandidates.findIndex(
      (candidate) => !cache.failedUrls.includes(candidate),
    );

    thumbIndexRef.current = nextThumbIndex >= 0 ? nextThumbIndex : imageCandidates.thumbCandidates.length;
    fullIndexRef.current = nextFullIndex >= 0 ? nextFullIndex : imageCandidates.fullCandidates.length;
    setThumbSrc(nextThumbIndex >= 0 ? imageCandidates.thumbCandidates[nextThumbIndex] ?? null : null);
    setFullSrc(nextFullIndex >= 0 ? imageCandidates.fullCandidates[nextFullIndex] ?? null : null);
    setThumbLoaded(cache.thumbLoaded);
    setFullLoaded(cache.fullLoaded);
    setFullActivated(false);
    setImgError(false);
  }, [product.id, imageCandidates]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setFullActivated(true);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "180px",
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [product.id]);

  const showThumb = Boolean(thumbSrc);
  const showFull = fullActivated && Boolean(fullSrc);
  const hasVisualImage = (thumbLoaded && Boolean(thumbSrc)) || (fullLoaded && Boolean(fullSrc));
  const showFallback = !hasVisualImage && (imgError || (!thumbSrc && !fullSrc));

  const hasDiscount = Boolean(product.offer && (product.offerDiscount ?? 0) > 0);
  const discount = product.offerDiscount ?? 0;
  const unitOriginal = product.unit.price;
  const unitDiscounted = hasDiscount
    ? Math.max(0, Math.round(unitOriginal * (1 - discount / 100)))
    : unitOriginal;

  const priceClass =
    tone === "offers"
      ? "text-[18px] font-black tracking-tight"
      : "text-sm font-semibold";

  const handleThumbError = () => {
    const failed = thumbSrc ?? "";
    addFailedUrl(product.id, failed);
    const nextIndex = thumbIndexRef.current + 1;
    if (nextIndex < imageCandidates.thumbCandidates.length) {
      thumbIndexRef.current = nextIndex;
      setThumbLoaded(false);
      setThumbSrc(imageCandidates.thumbCandidates[nextIndex] ?? null);
      return;
    }
    setThumbSrc(null);
    setThumbLoaded(false);
    if (imageCandidates.fullCandidates.length > 0) {
      requestThumbRepair(product.id);
    }
    if (!fullSrc && !fullLoaded) setImgError(true);
  };

  const handleFullError = () => {
    const failed = fullSrc ?? "";
    addFailedUrl(product.id, failed);
    const nextIndex = fullIndexRef.current + 1;
    if (nextIndex < imageCandidates.fullCandidates.length) {
      fullIndexRef.current = nextIndex;
      setFullLoaded(false);
      setFullSrc(imageCandidates.fullCandidates[nextIndex] ?? null);
      return;
    }
    setFullSrc(null);
    setFullLoaded(false);
  };

  return (
    <div
      ref={cardRef}
      className={[
        compact
          ? "flex h-full flex-col rounded-2xl border border-border bg-surface p-2 shadow-sm transition-opacity"
          : "rounded-2xl border border-border bg-surface p-2.5 shadow-sm transition-opacity sm:p-3",
        isOut ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className={compact ? "relative min-h-0 flex-1 overflow-hidden rounded-2xl" : "relative overflow-hidden rounded-2xl"}>
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {typeof addedQty === "number" && addedQty > 0 ? (
            <div className="rounded-full bg-[#23A55A] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              Agregado · x{addedQty}
            </div>
          ) : null}
          {isOut ? (
            <div className="rounded-full bg-[#1D3557] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              Sin stock
            </div>
          ) : null}
          {tag ? (
            <div className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              {tag}
            </div>
          ) : null}
        </div>

        <div
          className={[
            "relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white via-[#F3F6F9] to-[#E8EEF4]",
            compact ? "h-full min-h-0 p-2" : "aspect-square p-3 sm:p-4",
          ].join(" ")}
        >
          {isOut ? (
            <div className="pointer-events-none absolute inset-0 z-[1] bg-black/16" />
          ) : null}

          <div
            aria-hidden="true"
            className={[
              "absolute inset-0 transition-opacity duration-300",
              hasVisualImage ? "opacity-0" : "opacity-100",
              "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_44%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(69,123,157,0.05))]",
            ].join(" ")}
          />

          {showThumb ? (
            <img
              src={thumbSrc ?? undefined}
              alt={product.name}
              className={[
                "absolute inset-0 h-full w-full object-contain transition-all duration-500",
                isOut ? "brightness-[0.72] saturate-[0.82]" : "",
                thumbLoaded ? "scale-100 opacity-100 blur-0" : "scale-[1.045] opacity-100 blur-[14px]",
              ].join(" ")}
              loading="lazy"
              decoding="async"
              fetchPriority="high"
              onLoad={() => {
                setThumbLoaded(true);
                setCachedImageState(product.id, { thumbLoaded: true });
                setImgError(false);
              }}
              onError={handleThumbError}
            />
          ) : null}

          {showFull ? (
            <img
              src={fullSrc ?? undefined}
              alt={product.name}
              className={[
                "absolute inset-0 h-full w-full object-contain transition-opacity duration-500",
                isOut ? "brightness-[0.72] saturate-[0.82]" : "",
                fullLoaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoad={() => {
                setFullLoaded(true);
                setCachedImageState(product.id, { fullLoaded: true });
              }}
              onError={handleFullError}
            />
          ) : null}

          {!hasVisualImage && (thumbSrc || fullSrc) ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/68 p-2 shadow-sm backdrop-blur-sm">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-brand" />
              </div>
            </div>
          ) : null}

          {showFallback ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white/65 text-2xl font-black tracking-tight text-foreground/55">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          ) : null}
        </div>
      </div>

      <div className={compact ? "mt-1.5 grid shrink-0 grid-cols-1 gap-1" : "mt-2 grid grid-cols-1 gap-1.5 sm:mt-3 sm:gap-2"}>
        <div className={compact ? "px-0.5" : "px-0.5 sm:px-1"}>
          <div
            className={[
              compact
                ? "text-pretty text-[11px] font-semibold leading-[1rem]"
                : "text-pretty text-[12px] font-semibold leading-[1.15rem] sm:text-[13px] sm:leading-4",
              isOut ? "text-foreground/70" : "text-foreground",
            ].join(" ")}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: compact ? 2 : 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={product.name}
          >
            {product.name}
          </div>
        </div>
        <div
          className={[
            compact
              ? "flex items-center justify-between gap-1.5 rounded-xl bg-surface-2 px-2 py-1.5"
              : "flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-2.5 py-2 sm:px-3",
            isOut ? "bg-surface-2/70" : "",
          ].join(" ")}
        >
          <div className="min-w-0 flex-1">
            <div
              className={[
                isOut ? "text-foreground/70" : "text-foreground",
                priceClass,
                compact ? "text-[14px] leading-[1rem]" : "text-[13px] leading-4 sm:text-sm",
              ].join(" ")}
            >
              {hasDiscount ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className={isOut ? "text-foreground/70" : "text-foreground"}>
                    {formatArs(unitDiscounted)}
                  </span>
                  <span className="text-xs font-semibold text-foreground/45 line-through">
                    {formatArs(unitOriginal)}
                  </span>
                </span>
              ) : (
                formatArs(unitOriginal)
              )}{" "}
              <span className={compact ? "text-[10px] font-medium text-foreground/70" : "text-[11px] font-medium text-foreground/70 sm:text-xs"}>
                · {product.unit.label}
              </span>
            </div>
          </div>
          <MotionButton
            className={
              compact
                ? "h-7 shrink-0 rounded-lg px-2 text-[11px]"
                : "h-8 shrink-0 px-2.5 text-[12px] sm:h-9 sm:px-3 sm:text-sm"
            }
            onClick={onSelect}
            disabled={isOut}
          >
            {isOut ? "Sin stock" : typeof addedQty === "number" && addedQty > 0 ? "Editar" : "Elegir"}
          </MotionButton>
        </div>
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);

