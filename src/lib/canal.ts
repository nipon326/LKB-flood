import type { Status } from "./status";
import { resilientFetch } from "./resilientFetch";

// weather.bangkok.go.th blocks connections from every cloud network we
// tested directly (Vercel US, Vercel Singapore, GitHub Actions). Two data
// paths, tried in order:
//   1. RELAY_BASE_URL (a Cloudflare Worker, or any other relay run from a
//      network BMA doesn't block) re-scraping the same live HTML we used
//      to scrape directly — see cloudflare-worker/. Real-time when it works.
//   2. ThaiWater.net (สสน.), which mirrors the same BMA sensor network
//      (station names/coordinates match exactly) through a public API
//      that IS reachable from cloud infra — but its sync can lag BMA's own
//      feed by hours under load, so this is the fallback, not the primary.
// Whichever path answers, every reading shows its real timestamp — never
// implied as "live" — see StatusBanner/CanalGauge and status.ts#isStale.
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

// Each station has two IDs because the two sources number them differently:
// bmaId is weather.bangkok.go.th's water_id (used by the relay, which
// scrapes BMA directly), thaiwaterId is ThaiWater's own station.id.
// Only stations actually near the house are listed — the canal runs ~20km
// across Bangkok, and the rest of its BMA-monitored points are 9km+ away.
export const STATIONS: {
  bmaId: number;
  thaiwaterId: number;
  label: string;
  lat: number;
  lon: number;
  distanceKm: number;
  highlight?: boolean;
}[] = [
  {
    bmaId: 64,
    thaiwaterId: 106,
    label: "คลองประเวศฯ - รพ.ลาดกระบัง",
    lat: 13.72396,
    lon: 100.78399,
    distanceKm: 2.1,
    highlight: true,
  },
  {
    bmaId: 39,
    thaiwaterId: 81,
    label: "ปตร.คลองประเวศฯ - ลาดกระบัง",
    lat: 13.72411,
    lon: 100.74987,
    distanceKm: 2.9,
  },
];

// `id` is the bmaId — the canonical id used elsewhere in the app (e.g. to
// pick which station gets the history chart).
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
  source?: "relay" | "thaiwater";
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

// Both sources give Bangkok local time with no offset marker; anchor to
// +07:00 so timeAgo math is correct regardless of server timezone.
function toBangkokIso(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}${normalized.length <= 16 ? ":00" : ""}+07:00`;
}

interface RelayRawStation {
  water_id: number;
  warning: number | null;
  critical: number | null;
  water_level_last: { wl_in: number | null; site_timestamp: string | null } | null;
}

async function fetchFromRelay(baseUrl: string): Promise<CanalStation[]> {
  const res = await resilientFetch(`${baseUrl.replace(/\/$/, "")}/canal`, {
    headers: HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Relay HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Relay returned an error");
  const data: RelayRawStation[] = json.data ?? [];
  const byId = new Map(data.map((d) => [d.water_id, d]));

  return STATIONS.map((s) => {
    const raw = byId.get(s.bmaId);
    const level = raw?.water_level_last?.wl_in ?? null;
    const warning = raw?.warning ?? null;
    const critical = raw?.critical ?? null;
    return {
      id: s.bmaId,
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
}

interface ThaiWaterRecord {
  canal_datetime: string | null;
  canal_value: number | null;
  station: {
    id: number;
    warning_level: number | null;
    critical_level: number | null;
  };
}

async function fetchFromThaiWater(): Promise<CanalStation[]> {
  const res = await resilientFetch(
    "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/canal_waterlevel",
    { headers: HEADERS, next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`ThaiWater HTTP ${res.status}`);
  const json = await res.json();
  const data: ThaiWaterRecord[] = json.data ?? [];
  const byId = new Map(data.map((d) => [d.station.id, d]));

  return STATIONS.map((s) => {
    const raw = byId.get(s.thaiwaterId);
    const level = raw?.canal_value ?? null;
    const warning = raw?.station.warning_level ?? null;
    const critical = raw?.station.critical_level ?? null;
    return {
      id: s.bmaId,
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
}

export async function fetchCanalStations(): Promise<CanalResult> {
  const relayBase = process.env.RELAY_BASE_URL;
  if (relayBase) {
    try {
      const stations = await fetchFromRelay(relayBase);
      return { ok: true, stations, source: "relay" };
    } catch {
      // fall through to ThaiWater
    }
  }
  try {
    const stations = await fetchFromThaiWater();
    return { ok: true, stations, source: "thaiwater" };
  } catch (err) {
    return {
      ok: false,
      stations: [],
      error: err instanceof Error ? err.message : "ดึงข้อมูลระดับน้ำไม่สำเร็จ",
    };
  }
}
