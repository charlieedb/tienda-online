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
};

type ImageCacheEntry = {
  thumbLoaded: boolean;
  fullLoaded: boolean;
  failedUrls: string[];
};

const imageStateCache = new Map<string, ImageCacheEntry>();

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
        "rounded-2xl border border-border bg-surface p-3 shadow-sm transition-opacity",
        isOut ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {typeof addedQty === "number" && addedQty > 0 ? (
            <div className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              Agregado · x{addedQty}
            </div>
          ) : null}
          {isOut ? (
            <div className="rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              Sin stock
            </div>
          ) : null}
          {tag ? (
            <div className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
              {tag}
            </div>
          ) : null}
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white via-[#f5f1ef] to-[#ece7e4] p-4">
          {isOut ? (
            <div className="pointer-events-none absolute inset-0 z-[1] bg-black/16" />
          ) : null}

          <div
            aria-hidden="true"
            className={[
              "absolute inset-0 transition-opacity duration-300",
              hasVisualImage ? "opacity-0" : "opacity-100",
              "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_44%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(0,0,0,0.03))]",
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

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="px-1">
          <div
            className={[
              "text-pretty text-[13px] font-semibold leading-4",
              isOut ? "text-foreground/70" : "text-foreground",
            ].join(" ")}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
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
            "flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2",
            isOut ? "bg-surface-2/70" : "",
          ].join(" ")}
        >
          <div>
            <div className="text-xs font-semibold text-foreground/60">
              {product.brand ?? " "}
            </div>
            <div className={[isOut ? "text-foreground/70" : "text-foreground", priceClass].join(" ")}>
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
              <span className="text-xs font-medium text-foreground/70">
                · {product.unit.label}
              </span>
            </div>
          </div>
          <MotionButton className="h-9 px-3" onClick={onSelect} disabled={isOut}>
            {isOut ? "Sin stock" : typeof addedQty === "number" && addedQty > 0 ? "Editar" : "Elegir"}
          </MotionButton>
        </div>
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);
