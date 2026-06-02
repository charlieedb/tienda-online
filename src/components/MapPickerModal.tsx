"use client";

import { AnimatePresence, motion } from "framer-motion";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/userProfile";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

declare global {
  interface Window {
    L?: LeafletGlobal;
  }
}

type LeafletPoint = { lat: number; lng: number };
type LeafletMap = {
  setView: (coords: [number, number], zoom: number) => LeafletMap;
  getZoom: () => number;
  on: (event: "click", handler: (event: { latlng: LeafletPoint }) => void) => void;
  remove: () => void;
};
type LeafletMarker = {
  setLatLng: (coords: [number, number]) => void;
};
type LeafletGlobal = {
  map: (
    element: HTMLDivElement,
    options: { zoomControl: boolean; attributionControl: boolean },
  ) => LeafletMap;
  tileLayer: (
    url: string,
    options: { maxZoom: number; attribution: string },
  ) => { addTo: (map: LeafletMap) => void };
  marker: (coords: [number, number]) => { addTo: (map: LeafletMap) => LeafletMarker };
};

async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ format: "json", q, limit: "1" }).toString();
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = data?.[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function MapPickerModal({
  open,
  initial,
  center,
  initialQuery,
  onClose,
  onPick,
}: {
  open: boolean;
  initial: LatLng | null;
  center: LatLng | null;
  initialQuery: string;
  onClose: () => void;
  onPick: (p: LatLng) => void;
}) {
  useBodyScrollLock(open);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [picked, setPicked] = useState<LatLng | null>(initial);
  const [leafletReady, setLeafletReady] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const lastAutoQueryRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setPicked(initial);
      setQuery(initialQuery);
      setSearchError(null);
    });
    lastAutoQueryRef.current = "";
  }, [open, initial, initialQuery]);

  const baseCenter = useMemo<LatLng>(() => {
    return initial ?? picked ?? { lat: -34.6037, lng: -58.3816 };
  }, [initial, picked]);

  const desiredCenter = useMemo<LatLng>(() => {
    return center ?? baseCenter;
  }, [center, baseCenter]);

  useEffect(() => {
    if (!open) return;
    if (initial) return;
    if (picked) return;
    if (!center) return;
    queueMicrotask(() => {
      setPicked(center);
    });
  }, [open, initial, picked, center]);

  const setMarker = (p: LatLng) => {
    if (!leafletMapRef.current || !window.L) return;
    const L = window.L;
    if (!markerRef.current) markerRef.current = L.marker([p.lat, p.lng]).addTo(leafletMapRef.current);
    else markerRef.current.setLatLng([p.lat, p.lng]);
  };

  useEffect(() => {
    if (!open) return;
    if (!leafletReady) return;
    if (!mapDivRef.current) return;
    if (!window.L) return;

    const L = window.L;

    if (!leafletMapRef.current) {
      const map = L.map(mapDivRef.current, { zoomControl: true, attributionControl: true }).setView(
        [desiredCenter.lat, desiredCenter.lng],
        14,
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      map.on("click", (e) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        setPicked(p);
        setMarker(p);
      });

      leafletMapRef.current = map;
    } else {
      leafletMapRef.current.setView([desiredCenter.lat, desiredCenter.lng], leafletMapRef.current.getZoom() || 14);
    }

    if (picked) setMarker(picked);
  }, [open, leafletReady, desiredCenter.lat, desiredCenter.lng, picked]);

  useEffect(() => {
    if (open) return;
    const m = leafletMapRef.current;
    if (m) {
      m.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextQuery = initialQuery.trim();
    if (!nextQuery) return;
    if (lastAutoQueryRef.current === nextQuery) return;
    lastAutoQueryRef.current = nextQuery;

    let cancelled = false;
    const runAutoSearch = async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const point = await geocode(nextQuery);
        if (!point || cancelled) return;
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([point.lat, point.lng], 15);
        }
        setPicked(point);
        setMarker(point);
      } catch {
        if (!cancelled) {
          setSearchError("No se pudo orientar el mapa con esa dirección.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    void runAutoSearch();
    return () => {
      cancelled = true;
    };
  }, [open, initialQuery]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <Script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            strategy="afterInteractive"
            onLoad={() => setLeafletReady(true)}
          />

          <motion.button
            aria-label="Cerrar"
            className="modal-backdrop-lite fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-[90] w-[min(760px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-white shadow-2xl"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-black">Marcar ubicación</div>
                  <div className="mt-1 text-xs text-black/70">Buscá una dirección o tocá el mapa.</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/5"
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-[16px] text-black outline-none focus:border-brand/50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar dirección…"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (searching) return;
                    setSearching(true);
                    setSearchError(null);
                    try {
                      const p = await geocode(query);
                      if (!p) {
                        setSearchError("No encontré esa dirección. Probá con más detalle.");
                        return;
                      }
                      if (leafletMapRef.current) {
                        leafletMapRef.current.setView([p.lat, p.lng], 15);
                      }
                      setPicked(p);
                      setMarker(p);
                    } catch {
                      setSearchError("No se pudo buscar la dirección. Intentá de nuevo.");
                    } finally {
                      setSearching(false);
                    }
                  }}
                  className="h-11 shrink-0 rounded-2xl bg-[#1f2a8a] px-4 text-sm font-black text-white disabled:opacity-60"
                  disabled={!query.trim() || searching}
                >
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </div>

              {searchError ? <div className="mt-2 text-xs font-semibold text-red-600">{searchError}</div> : null}
            </div>

            <div className="relative h-[52vh] min-h-[320px] w-full bg-zinc-100">
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
              <div ref={mapDivRef} className="h-full w-full" />
              {!leafletReady ? (
                <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-black/70">
                  Cargando mapa…
                </div>
              ) : null}
            </div>

            <div className="border-t border-border px-5 py-4">
              <button
                type="button"
                disabled={!picked}
                onClick={() => {
                  if (!picked) return;
                  onPick(picked);
                  onClose();
                }}
                className="h-11 w-full rounded-2xl bg-brand text-sm font-black text-white disabled:opacity-50"
              >
                Usar esta ubicación
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
