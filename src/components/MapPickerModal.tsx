import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { LatLng } from "@/lib/userProfile";

async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ format: "json", q, limit: "1" }).toString();
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("No se pudo consultar la dirección.");
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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
  onPick: (point: LatLng) => void;
}) {
  useBodyScrollLock(open);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [picked, setPicked] = useState<LatLng | null>(initial);
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  const baseCenter = useMemo(
    () => picked ?? center ?? initial ?? { lat: -34.6037, lng: -58.3816 },
    [picked, center, initial],
  );

  const placeMarker = (point: LatLng, zoom = 16) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng([point.lat, point.lng]);
    else markerRef.current = L.marker([point.lat, point.lng]).addTo(map);
    map.setView([point.lat, point.lng], zoom);
  };

  useEffect(() => {
    if (!open) return;
    setPicked(initial);
    setQuery(initialQuery);
    setMessage("");

    const frame = requestAnimationFrame(() => {
      if (!mapDivRef.current || mapRef.current) return;
      const map = L.map(mapDivRef.current, { zoomControl: true }).setView(
        [baseCenter.lat, baseCenter.lng],
        14,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      map.on("click", (event) => {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        setPicked(point);
        if (markerRef.current) markerRef.current.setLatLng(event.latlng);
        else markerRef.current = L.marker(event.latlng).addTo(map);
      });
      mapRef.current = map;
      if (initial) placeMarker(initial);
      setTimeout(() => map.invalidateSize(), 0);
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return;
    mapRef.current?.remove();
    mapRef.current = null;
    markerRef.current = null;
  }, [open]);

  const searchAddress = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setMessage("");
    try {
      const point = await geocode(query);
      if (!point) {
        setMessage("No encontré esa dirección. Probá agregando localidad y provincia.");
        return;
      }
      setPicked(point);
      placeMarker(point);
    } catch {
      setMessage("No se pudo buscar la dirección. Intentá nuevamente.");
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation || locating) {
      if (!navigator.geolocation) setMessage("Este dispositivo no permite obtener la ubicación.");
      return;
    }
    setLocating(true);
    setMessage("Obteniendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        setPicked(point);
        placeMarker(point, 17);
        setMessage("Ubicación encontrada. Podés ajustar el punto tocando el mapa.");
        setLocating(false);
      },
      () => {
        setMessage("No pudimos acceder a tu ubicación. Revisá el permiso del navegador.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar mapa"
            className="modal-backdrop-lite fixed inset-0 z-[130]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center p-2">
            <motion.section
              className="pointer-events-auto w-full max-w-[720px] overflow-hidden rounded-2xl bg-white"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-picker-title"
            >
            <header className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="map-picker-title" className="text-base font-semibold text-black">Punto de entrega</h2>
                  <p className="mt-0.5 text-sm text-black/70">Buscá la dirección o tocá el punto exacto en el mapa.</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-black/70 hover:bg-black/5">
                  Cerrar
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-[16px] font-normal text-black outline-none focus:border-brand"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchAddress();
                  }}
                  placeholder="Calle, número y localidad"
                />
                <button
                  type="button"
                  onClick={() => void searchAddress()}
                  className="h-11 shrink-0 rounded-xl bg-[#1f2a8a] px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!query.trim() || searching}
                >
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </div>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="mt-2 h-10 w-full rounded-xl bg-[#d9f1ff] px-4 text-sm font-semibold text-[#075985] disabled:opacity-60"
              >
                {locating ? "Buscando mi ubicación…" : "Usar mi ubicación actual"}
              </button>
              {message ? <p className="mt-2 text-sm font-normal text-black/75" aria-live="polite">{message}</p> : null}
            </header>

            <div className="relative h-[min(46dvh,420px)] min-h-[270px] w-full bg-zinc-100">
              <div ref={mapDivRef} className="h-full w-full" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black shadow">
                Tocá el mapa para mover el punto
              </div>
            </div>

            <footer className="border-t border-border p-4">
              <button
                type="button"
                disabled={!picked}
                onClick={() => {
                  if (!picked) return;
                  onPick(picked);
                  onClose();
                }}
                className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50"
              >
                {picked ? "Confirmar punto de entrega" : "Marcá un punto en el mapa"}
              </button>
            </footer>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
