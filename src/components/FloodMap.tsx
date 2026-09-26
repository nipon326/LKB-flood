"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { CanalStation } from "@/lib/canal";
import { STATUS_META, timeAgoThai } from "@/lib/status";

// Only the station coordinates (public infrastructure) are plotted here —
// never the exact home address, even though the map is centered near it.
export default function FloodMap({ stations }: { stations: CanalStation[] }) {
  const withCoords = stations.filter((s) => s.lat && s.lon);
  if (withCoords.length === 0) return null;

  const centerLat =
    withCoords.reduce((sum, s) => sum + s.lat, 0) / withCoords.length;
  const centerLon =
    withCoords.reduce((sum, s) => sum + s.lon, 0) / withCoords.length;

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: 280, width: "100%", borderRadius: "1rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map((s) => {
        const meta = STATUS_META[s.status];
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={14}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: meta.solid,
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <strong>{s.label}</strong>
                <br />
                {meta.emoji} {meta.label}
                {s.level !== null && <> — {s.level.toFixed(2)} ม.</>}
                <br />
                <span style={{ color: "#898781" }}>
                  อัปเดต {timeAgoThai(s.updatedAt)}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
