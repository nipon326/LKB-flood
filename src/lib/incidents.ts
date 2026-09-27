import { resilientFetch } from "./resilientFetch";

// Longdo Traffic's crowd-sourced incident reports (traffic.longdo.com) —
// citizens report floods/road issues with a title, location and often a
// photo. Reachable from cloud infra (unlike weather.bangkok.go.th), so no
// relay needed. This is what fills the "camera" slot in the user's content
// priority (map -> water level -> [camera] -> weather -> news): BMA's own
// cameras need a LINE login + per-request form, and the one open camera
// source (iTIC via this same site) has nothing within a useful distance of
// the house — but these incident *reports* are both open and hyperlocal.
const INCIDENT_URL = "https://traffic.longdo.com/incident.json";
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

const RADIUS_KM = 8;
const MAX_AGE_HOURS = 24;
const MAX_ITEMS = 10;

export interface Incident {
  id: string;
  title: string;
  distanceKm: number;
  createdAt: string;
  imageUrl: string | null;
}

export interface IncidentResult {
  ok: boolean;
  incidents: Incident[];
  error?: string;
}

interface RawIncident {
  eid: string;
  title: string;
  latitude: string;
  longitude: string;
  createtime: string;
  imagenid: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// "YYYY-MM-DD HH:mm:ss" Bangkok local time with no offset marker.
function toBangkokIso(raw: string): string {
  return `${raw.replace(" ", "T")}+07:00`;
}

export async function fetchNearbyIncidents(): Promise<IncidentResult> {
  const homeLat = Number(process.env.HOME_LAT);
  const homeLon = Number(process.env.HOME_LON);
  if (!Number.isFinite(homeLat) || !Number.isFinite(homeLon)) {
    return { ok: true, incidents: [] };
  }

  try {
    const res = await resilientFetch(INCIDENT_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw: RawIncident[] = json.item ?? [];

    const cutoffMs = Date.now() - MAX_AGE_HOURS * 3600 * 1000;

    const incidents = raw
      .map((x): Incident | null => {
        const lat = Number(x.latitude);
        const lon = Number(x.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const distanceKm = haversineKm(homeLat, homeLon, lat, lon);
        if (distanceKm > RADIUS_KM) return null;

        const createdAt = toBangkokIso(x.createtime);
        const createdMs = new Date(createdAt).getTime();
        if (!Number.isFinite(createdMs) || createdMs < cutoffMs) return null;

        return {
          id: x.eid,
          title: x.title,
          distanceKm,
          createdAt,
          imageUrl:
            x.imagenid && x.imagenid !== "0"
              ? `https://event.longdo.com/image/view/${x.imagenid}/thumbnail`
              : null,
        };
      })
      .filter((x): x is Incident => x !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_ITEMS);

    return { ok: true, incidents };
  } catch (err) {
    return {
      ok: false,
      incidents: [],
      error: err instanceof Error ? err.message : "ดึงรายงานสถานการณ์ไม่สำเร็จ",
    };
  }
}
