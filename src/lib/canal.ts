import type { Status } from "./status";
import { resilientFetch } from "./resilientFetch";

const SUMMARY_URL = "https://weather.bangkok.go.th/water/Summary";
// BMA's site rejects StationDetail requests without a same-site referer.
export const BMA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)",
  Referer: "https://weather.bangkok.go.th/water/Summary",
};

// Stations on Khlong Prawet Buri Rom, found by inspecting the `allData`
// dataset embedded in the BMA page above. Real coordinates come from each
// station's own StationDetail page (see canalHistory.ts). Of the six
// candidates on this canal, only these two are actually near the house
// (checked by distance from HOME_LAT/HOME_LON) — the canal runs ~20km
// west-to-east through several districts, so the others (Wat Khajonsiri,
// Thanon Ruam Phatthana, the Royal Irrigation Dept gate, Wat Krathum Suea
// Pla) are 9-14km away and would be misleading to label "nearby".
export const STATIONS: {
  id: number;
  label: string;
  lat: number;
  lon: number;
  distanceKm: number;
  highlight?: boolean;
}[] = [
  {
    id: 64,
    label: "คลองประเวศฯ - รพ.ลาดกระบัง",
    lat: 13.72396,
    lon: 100.78399,
    distanceKm: 2.1,
    highlight: true,
  },
  {
    id: 39,
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

interface RawStation {
  water_id: number;
  warning: number | null;
  critical: number | null;
  water_level_last: {
    wl_in: number | null;
    site_timestampTH: string | null;
    site_timestamp: string | null;
  } | null;
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

// BMA timestamps are Bangkok local time with no offset marker; anchor them
// to +07:00 so timeAgo math is correct regardless of server timezone.
function toBangkokIso(raw: string | null): string | null {
  if (!raw) return null;
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}+07:00`;
}

export async function fetchCanalStations(): Promise<CanalResult> {
  try {
    const res = await resilientFetch(SUMMARY_URL, {
      headers: BMA_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const match = html.match(/const allData = (\[[\s\S]*?\]);/);
    if (!match) throw new Error("ไม่พบข้อมูลสถานีในหน้าเว็บ (รูปแบบหน้าเว็บอาจเปลี่ยน)");
    const data: RawStation[] = JSON.parse(match[1]);
    const byId = new Map(data.map((d) => [d.water_id, d]));

    const stations: CanalStation[] = STATIONS.map((s) => {
      const raw = byId.get(s.id);
      const level = raw?.water_level_last?.wl_in ?? null;
      const warning = raw?.warning ?? null;
      const critical = raw?.critical ?? null;
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
        updatedAt: toBangkokIso(raw?.water_level_last?.site_timestamp ?? null),
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
