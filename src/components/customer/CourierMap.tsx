import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orderId: string;
  destination?: { lat: number; lng: number } | null;
}

// Markers con emoji (divIcon) para evitar el problema de assets de los íconos por defecto de Leaflet.
const courierIcon = L.divIcon({ html: '<div style="font-size:26px;line-height:1">🛵</div>', className: "", iconSize: [26, 26], iconAnchor: [13, 13] });
const destIcon = L.divIcon({ html: '<div style="font-size:24px;line-height:1">📍</div>', className: "", iconSize: [24, 24], iconAnchor: [12, 24] });

// Centro por defecto: Casilda, Santa Fe (aprox) hasta tener la ubicación real.
const DEFAULT_CENTER: [number, number] = [-33.045, -61.168];

export function CourierMap({ orderId, destination }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMarker = useRef<L.Marker | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    if (destination) {
      L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(map).bindPopup("Tu dirección");
      map.setView([destination.lat, destination.lng], 15);
    }
    mapRef.current = map;
    // Leaflet a veces necesita recalcular el tamaño tras montar.
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapRef.current = null;
      courierMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    const fetchLoc = async () => {
      const { data } = await supabase.functions.invoke("order-courier-location", { body: { order_id: orderId } });
      if (!active || !mapRef.current) return;
      if (data?.available) {
        setAvailable(true);
        setName(data.name);
        const ll: [number, number] = [data.lat, data.lng];
        if (!courierMarker.current) {
          courierMarker.current = L.marker(ll, { icon: courierIcon }).addTo(mapRef.current).bindPopup(data.name || "Repartidor");
        } else {
          courierMarker.current.setLatLng(ll);
        }
        if (destination) {
          mapRef.current.fitBounds(L.latLngBounds([ll, [destination.lat, destination.lng]]).pad(0.35));
        } else {
          mapRef.current.setView(ll, 15);
        }
      } else {
        setAvailable(false);
      }
    };
    fetchLoc();
    const t = setInterval(fetchLoc, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [orderId, destination]);

  return (
    <div className="space-y-1">
      <div ref={elRef} className="h-56 w-full overflow-hidden rounded-xl border" />
      <p className="text-center text-xs text-muted-foreground">
        {available ? `${name ?? "Tu repartidor"} va en camino 🛵` : "Esperando la ubicación del repartidor…"}
      </p>
    </div>
  );
}
