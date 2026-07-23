import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

  if (typeof document === "undefined") return null;

  return createPortal(
    open ? (
      <section
        className="delivery-map-view"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-picker-title"
      >
            <header className="delivery-map-header">
              <div className="delivery-map-title-row">
                <div>
                  <h2 id="map-picker-title" className="text-base font-semibold text-black">Punto de entrega</h2>
                  <p className="mt-0.5 text-sm text-black/70">Buscá la dirección o tocá el punto exacto en el mapa.</p>
                </div>
                <button type="button" onClick={onClose} className="delivery-map-close">
                  Cerrar
                </button>
              </div>
              <div className="delivery-map-search">
                <input
                  className="delivery-map-search-input"
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
                  className="delivery-map-search-button"
                  disabled={!query.trim() || searching}
                >
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </div>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="delivery-map-locate"
              >
                {locating ? "Buscando mi ubicación…" : "Usar mi ubicación actual"}
              </button>
              {message ? <p className="delivery-map-message" aria-live="polite">{message}</p> : null}
            </header>

            <div className="delivery-map-canvas">
              <div ref={mapDivRef} className="delivery-map-leaflet" />
              <div className="delivery-map-hint">
                Tocá el mapa para mover el punto
              </div>
            </div>

            <footer className="delivery-map-footer">
              <button
                type="button"
                disabled={!picked}
                onClick={() => {
                  if (!picked) return;
                  onPick(picked);
                  onClose();
                }}
                className="delivery-map-confirm"
              >
                {picked ? "Guardar punto y volver" : "Marcá un punto en el mapa"}
              </button>
            </footer>
      </section>
    ) : null,
    document.body,
  );
}
