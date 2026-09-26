// Never expose the exact home coordinates to the client — this deployment
// is a public URL with no password. Server Components may read the precise
// HOME_LAT/HOME_LON env vars directly (see forecast.ts), but anything
// passed down into client-rendered UI (e.g. the map) must go through this
// function first, which shifts the point by a fixed ~400m offset so only
// the general neighborhood is shown, never the exact house.
//
// A fixed offset (rather than grid-rounding) is used deliberately: rounding
// to a grid can land arbitrarily close to the true point if it happens to
// sit near a grid line, while a fixed-distance shift guarantees the same
// ~400m separation every time.
const OFFSET_METERS = 400;
const BEARING_DEG = 35; // arbitrary fixed direction, not meaningful

export interface ApproxLocation {
  lat: number;
  lon: number;
  label: string;
}

export function approximateHomeLocation(): ApproxLocation | null {
  const lat = Number(process.env.HOME_LAT);
  const lon = Number(process.env.HOME_LON);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180);
  const bearingRad = (BEARING_DEG * Math.PI) / 180;
  const dLat = (OFFSET_METERS * Math.cos(bearingRad)) / metersPerDegLat;
  const dLon = (OFFSET_METERS * Math.sin(bearingRad)) / metersPerDegLon;

  return {
    // Trimmed to 3 decimals (~110m) so the value doesn't imply false
    // precision on top of the intentional offset.
    lat: Math.round((lat + dLat) * 1000) / 1000,
    lon: Math.round((lon + dLon) * 1000) / 1000,
    label: "หมู่บ้านสุวรรณาวิลล์",
  };
}
