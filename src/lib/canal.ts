import type { Status } from "./status";
import { resilientFetch } from "./resilientFetch";

// weather.bangkok.go.th (the source of truth for these sensors) actively
// blocks connections from every cloud network we tested (Vercel US,
// Vercel Singapore, GitHub Actions) — the flood event itself is likely
// driving elevated traffic and stricter WAF rules there. ThaiWater.net
// (สสน. — the National Hydroinformatics Data Center) mirrors the same BMA
// sensor network (station names/coordinates match exactly) through a
// public API that IS reachable from cloud infra, so we read from there
// instead. Trade-off: its sync can lag BMA's own live feed by hours during
// high load, so every reading here must show its real timestamp — never
// implied as "live" — see StatusBanner/CanalGauge.
const CANAL_LIST_URL =
  "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/canal_waterlevel";
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

// Stations on Khlong Prawet Buri Rom nearest the house (checked by distance
// from HOME_LAT/HOME_LON — the canal runs ~20km across Bangkok, so most
// stations on it are 9km+ away and would be misleading to label "nearby").
// IDs are ThaiWater's `station.id`, found via its canal_waterlevel API.
export const STATIONS: {
  id: number;
  label: string;
  lat: number;
  lon: number;
  distanceKm: number;
  highlight?: boolean;
}[] = [
  {
    id: 106,
    label: "คลองประเวศฯ - รพ.ลาดกระบัง",
    lat: 13.72396,
    lon: 100.78399,
    distanceKm: 2.1,
    highlight: true,
  },
  {
    id: 81,
    label: "ปตร.คลองประเวศฯ - ลาดกระบัง",
    lat: 13.72411,
    lon: 100.74987,
    distanceKm: 2.9,
  },
];

export interface CanalStation {
  id: number;
  label: string;
  lat: number;
  lon: number;
  distanceKm: number;
  highlight: boolean;
  level: number | null;
  warning: number | null;
  critical: number | null;
  status: Status;
  updatedAt: string | null;
}

export interface CanalResult {
  ok: boolean;
  stations: CanalStation[];
  error?: string;
}

interface RawCanalRecord {
  canal_datetime: string | null;
  canal_value: number | null;
  station: {
    id: number;
    warning_level: number | null;
    critical_level: number | null;
  };
}

function computeStatus(
  level: number | null,
  warning: number | null,
  critical: number | null
): Status {
  if (level === null || warning === null || critical === null)
    return "unknown";
  if (level >= critical) return "critical";
  if (level >= warning) return "warning";
  return "normal";
}

// ThaiWater timestamps ("YYYY-MM-DD HH:mm") are Bangkok local time with no
// offset marker; anchor them to +07:00 so timeAgo math is correct
// regardless of server timezone.
function toBangkokIso(raw: string | null): string | null {
  if (!raw) return null;
  return `${raw.replace(" ", "T")}:00+07:00`;
}

export async function fetchCanalStations(): Promise<CanalResult> {
  try {
    const res = await resilientFetch(CANAL_LIST_URL, {
      headers: HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data: RawCanalRecord[] = json.data ?? [];
    const byId = new Map(data.map((d) => [d.station.id, d]));

    const stations: CanalStation[] = STATIONS.map((s) => {
      const raw = byId.get(s.id);
      const level = raw?.canal_value ?? null;
      const warning = raw?.station.warning_level ?? null;
      const critical = raw?.station.critical_level ?? null;
      return {
        id: s.id,
        label: s.label,
        lat: s.lat,
        lon: s.lon,
        distanceKm: s.distanceKm,
        highlight: Boolean(s.highlight),
        level,
        warning,
        critical,
        status: computeStatus(level, warning, critical),
        updatedAt: toBangkokIso(raw?.canal_datetime ?? null),
      };
    });

    return { ok: true, stations };
  } catch (err) {
    return {
      ok: false,
      stations: [],
      error: err instanceof Error ? err.message : "ดึงข้อมูลระดับน้ำไม่สำเร็จ",
    };
  }
}
