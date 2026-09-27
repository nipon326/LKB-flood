"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import { CanalStation } from "@/lib/canal";
import { ApproxLocation } from "@/lib/homeLocation";
import { STATUS_META, timeAgoThai } from "@/lib/status";

const homeIcon = L.divIcon({
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🏠</div>',
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Only the station coordinates (public infrastructure) are plotted here at
// full precision. `home`, if given, must already be an approximate/fuzzed
// point (see lib/homeLocation.ts) — this component never receives the
// exact address, since this site's URL is public with no password.
export default function FloodMap({
  stations,
  home,
}: {
  stations: CanalStation[];
  home?: ApproxLocation | null;
}) {
  const withCoords = stations.filter((s) => s.lat && s.lon);
  if (withCoords.length === 0) return null;

  const points = home
    ? [...withCoords, { lat: home.lat, lon: home.lon }]
    : withCoords;
  const centerLat = points.reduce((sum, s) => sum + s.lat, 0) / points.length;
  const centerLon = points.reduce((sum, s) => sum + s.lon, 0) / points.length;

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-[280px] sm:h-[420px]"
      style={{ width: "100%", borderRadius: "1rem" }}
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
      {home && (
        <Marker position={[home.lat, home.lon]} icon={homeIcon}>
          <Popup>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              🏠 <strong>{home.label}</strong>
              <br />
              <span style={{ color: "#898781" }}>ตำแหน่งโดยประมาณ</span>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
