"use client";

import { AnimatePresence, motion } from "framer-motion";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type Point = { lat: number; lng: number };

declare global {
  interface Window {
    L?: any;
  }
}

export function MapPickerModal({
  open,
  initial,
  onClose,
  onPick,
}: {
  open: boolean;
  initial: Point | null;
  onClose: () => void;
  onPick: (p: Point) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [picked, setPicked] = useState<Point | null>(initial);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(initial);
  }, [open, initial]);

  const center = useMemo<Point>(() => {
    return initial ?? picked ?? { lat: -34.6037, lng: -58.3816 };
  }, [initial, picked]);

  useEffect(() => {
    if (!open) return;
    if (!leafletReady) return;
    if (!mapDivRef.current) return;
    if (!window.L) return;

    const L = window.L;

    if (!leafletMapRef.current) {
      const map = L.map(mapDivRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([center.lat, center.lng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      map.on("click", (e: any) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        setPicked(p);
        if (!markerRef.current) {
          markerRef.current = L.marker([p.lat, p.lng]).addTo(map);
        } else {
          markerRef.current.setLatLng([p.lat, p.lng]);
        }
      });

      leafletMapRef.current = map;
    } else {
      leafletMapRef.current.setView([center.lat, center.lng], leafletMapRef.current.getZoom() || 14);
    }

    if (picked) {
      if (!markerRef.current) {
        markerRef.current = L.marker([picked.lat, picked.lng]).addTo(leafletMapRef.current);
      } else {
        markerRef.current.setLatLng([picked.lat, picked.lng]);
      }
    }
  }, [open, leafletReady, center.lat, center.lng, picked]);

  useEffect(() => {
    if (open) return;
    // Destroy the map to avoid issues when reopening in mobile webviews.
    const m = leafletMapRef.current;
    if (m) {
      m.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    }
  }, [open]);

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
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed left-1/2 top-1/2 z-[90] w-[min(720px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-white shadow-2xl"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-black">Marcar ubicación</div>
                <div className="mt-1 text-xs text-black/70">
                  Tocá el mapa para poner un pin.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/5"
              >
                Cerrar
              </button>
            </div>

            <div className="relative h-[52vh] min-h-[320px] w-full bg-zinc-100">
              <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
              />
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
                className="h-11 w-full rounded-2xl bg-[#1f2a8a] text-sm font-black text-white disabled:opacity-50"
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

