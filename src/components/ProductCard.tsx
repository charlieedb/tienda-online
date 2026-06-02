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

function ProductCardInner({
  product,
  onSelect,
  tag,
  addedQty = null,
  tone = "default",
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgActivated, setImgActivated] = useState(false);
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
    const candidates: string[] = [];
    const add = (value: string) => {
      const next = value.trim();
      if (!next || candidates.includes(next)) return;
      candidates.push(next);
    };

    if (u) {
      add(u);
      add(
        u
          .replace("fotosProductosThumb%2F", "fotosProductos%2F")
          .replace("/fotosProductosThumb/", "/fotosProductos/"),
      );
      if (product.id.includes("/")) {
        add(withStorageSafeFilename(u));
        add(
          withStorageSafeFilename(
            u
              .replace("fotosProductosThumb%2F", "fotosProductos%2F")
              .replace("/fotosProductosThumb/", "/fotosProductos/"),
          ),
        );
      }
    }

    if (storageBucket) {
      const safeId = product.id.replaceAll("/", "_");
      add(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(`fotosProductosThumb/${safeId}.jpg`)}?alt=media`,
      );
      add(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(`fotosProductos/${safeId}.jpg`)}?alt=media`,
      );
    }

    return candidates;
  }, [product.id, product.imageUrl, storageBucket]);

  const [imgSrc, setImgSrc] = useState<string | null>(imageCandidates[0] ?? null);
  const candidateIndexRef = useRef(0);
  useEffect(() => {
    setImgError(false);
    setImgSrc(imageCandidates[0] ?? null);
    setImgLoaded(false);
    setImgActivated(false);
    candidateIndexRef.current = 0;
  }, [imageCandidates]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setImgActivated(true);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "220px",
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [product.id]);

  const showImage = imgActivated && Boolean(imgSrc) && !imgError;

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
        <div className="relative aspect-square w-full p-4">
          {isOut ? (
            <div className="pointer-events-none absolute inset-0 z-[1] bg-black/18" />
          ) : null}
          <div
            aria-hidden="true"
            className={[
              "absolute inset-0",
              "bg-gradient-to-br from-black/5 via-black/0 to-black/10",
              "transition-opacity duration-300",
              imgLoaded ? "opacity-0" : "opacity-100",
            ].join(" ")}
          />
          {!imgLoaded && showImage ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/15 border-t-black/45" />
            </div>
          ) : null}
          {showImage ? (
            // Using a plain <img> here for faster first paint and predictable error fallback.
            // (The catalog already points to a resized thumb in Firebase Storage.)
            <img
              src={imgSrc ?? undefined}
              alt={product.name}
              className={[
                "absolute inset-0 h-full w-full object-contain",
                "transition-opacity duration-300",
                isOut ? "brightness-[0.72] saturate-[0.82]" : "",
                imgLoaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              loading="lazy"
              decoding="async"
              fetchPriority={imgActivated ? "high" : "low"}
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                const nextIndex = candidateIndexRef.current + 1;
                if (nextIndex < imageCandidates.length) {
                  candidateIndexRef.current = nextIndex;
                  setImgLoaded(false);
                  setImgSrc(imageCandidates[nextIndex] ?? null);
                  return;
                }
                setImgError(true);
                setImgLoaded(false);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-black tracking-tight text-foreground/50">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="px-1">
          <div
            className={["text-pretty text-[13px] font-semibold leading-4", isOut ? "text-foreground/70" : "text-foreground"].join(" ")}
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
        <div className={["flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2", isOut ? "bg-surface-2/70" : ""].join(" ")}>
          <div>
            <div className="text-xs font-semibold text-foreground/60">
              {product.brand ?? " "}
            </div>
            <div className={[isOut ? "text-foreground/70" : "text-foreground", priceClass].join(" ")}>
              {hasDiscount ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className={isOut ? "text-foreground/70" : "text-foreground"}>{formatArs(unitDiscounted)}</span>
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
