"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { TrainingCenter } from "@/lib/types";

// Leaflet interacts directly with the DOM, so it must be dynamically imported on the client side
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function TrainingCenterMap({ centers, beneficiaryLocation }: { centers: TrainingCenter[], beneficiaryLocation?: { lat: number, lng: number } }) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import("leaflet").then((leaflet) => {
      // Fix marker icon issues in next.js
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setL(leaflet);
    });
  }, []);

  if (!L) return <div className="h-[400px] w-full bg-slate-100 flex items-center justify-center animate-pulse rounded-2xl">Loading map...</div>;

  // Default to India center if no centers or location available
  const defaultCenter: [number, number] = [20.5937, 78.9629]; 
  const center: [number, number] = beneficiaryLocation ? [beneficiaryLocation.lat, beneficiaryLocation.lng] : (centers.length > 0 ? [centers[0].lat, centers[0].lng] : defaultCenter);
  const zoom = beneficiaryLocation || centers.length > 0 ? 10 : 5;

  return (
    <div className="h-[400px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm relative z-0">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full relative z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {beneficiaryLocation && (
          <Marker position={[beneficiaryLocation.lat, beneficiaryLocation.lng]} icon={new L.Icon({
            iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })}>
            <Popup>
              <b>Beneficiary Location</b>
            </Popup>
          </Marker>
        )}
        {centers.map((tc) => (
          <Marker key={tc.id} position={[tc.lat, tc.lng]}>
            <Popup>
              <div className="text-sm">
                <b>{tc.name}</b><br/>
                {tc.district}, {tc.state}<br/>
                Phone: {tc.phone}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
