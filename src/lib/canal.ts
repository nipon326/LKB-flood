import type { Status } from "./status";
import { resilientFetch } from "./resilientFetch";

// weather.bangkok.go.th blocks connections from every cloud network we
// tested directly (Vercel US, Vercel Singapore, GitHub Actions, and
// eventually Cloudflare Workers too — it appears to blocklist hosting/cloud
// ASNs generally, not one specific vendor). Three data paths, tried in order:
//   1. The published snapshot (SNAPSHOT_URL below) — scripts/publish-snapshot.mjs
//      run manually from a residential/office network, committed to this
//      repo's `data` branch, read here via GitHub's raw-content CDN (not
//      blocked). Freshness depends entirely on someone having run the
//      script recently — stale beyond SNAPSHOT_MAX_AGE_HOURS is skipped.
//   2. RELAY_BASE_URL (a Cloudflare Worker, or any other relay run from a
//      network BMA doesn't block) re-scraping the same live HTML. Currently
//      unset in practice since BMA blocks Cloudflare Workers specifically
//      now — kept as a fallback in case that ever changes.
//   3. ThaiWater.net (สสน.), which mirrors the same BMA sensor network
//      (station names/coordinates match exactly) through a public API
//      that IS reachable from cloud infra — but its sync can lag BMA's own
//      feed by many hours under load, so this is the last resort, not
//      something to route around.
// Whichever path answers, every reading shows its real timestamp — never
// implied as "live" — see StatusBanner/CanalGauge and status.ts#isStale.
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

// Each station has two IDs because the two sources number them differently:
// bmaId is weather.bangkok.go.th's water_id (used by the relay, which
// scrapes BMA directly), thaiwaterId is ThaiWater's own station.id — cross
// checked by matching warning/critical thresholds between the two APIs.
// BMA monitors many separate canals around Lat Krabang, not just Khlong
// Prawet Buri Rom (the one this list started with) — these are all within
// ~4km of the house, ordered by distance.
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
    bmaId: 202,
    thaiwaterId: 244,
    label: "คลองสี่ - ถ.เจ้าคุณทหาร",
    lat: 13.75363,
    lon: 100.7689,
    distanceKm: 1.7,
  },
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
    bmaId: 201,
    thaiwaterId: 243,
    label: "คลองสาม - มอเตอร์เวย์",
    lat: 13.7302,
    lon: 100.7541,
    distanceKm: 2.1,
  },
  {
    bmaId: 135,
    thaiwaterId: 177,
    label: "คลองลำปลาทิว - ซ.ฉลองกรุง 8",
    lat: 13.74068,
    lon: 100.79474,
    distanceKm: 2.5,
  },
  {
    bmaId: 39,
    thaiwaterId: 81,
    label: "ปตร.คลองประเวศฯ - ลาดกระบัง",
    lat: 13.72411,
    lon: 100.74987,
    distanceKm: 2.9,
  },
  {
    bmaId: 131,
    thaiwaterId: 173,
    label: "คลองสองต้นนุ่น - ถ.มอเตอร์เวย์",
    lat: 13.72975,
    lon: 100.73899,
    distanceKm: 3.7,
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
  source?: "snapshot" | "relay" | "thaiwater";
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

// Shared by the relay and the published-snapshot source, since both serve
// the same BMA raw record shape (snapshot.json is literally the relay's
// /canal payload, published from a residential network instead).
function mapRawStations(data: RelayRawStation[]): CanalStation[] {
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

async function fetchFromRelay(baseUrl: string): Promise<CanalStation[]> {
  const res = await resilientFetch(`${baseUrl.replace(/\/$/, "")}/canal`, {
    headers: HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Relay HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Relay returned an error");
  return mapRawStations(json.data ?? []);
}

// Published by scripts/publish-snapshot.mjs, run manually from a
// residential/office network (BMA blocks every cloud network tested, but
// this static JSON file is just served from GitHub's CDN, which isn't
// blocked). Only trusted while reasonably fresh — if nobody has run the
// script recently this falls through to ThaiWater instead.
export const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/nipon326/LKB-flood/data/data/snapshot.json";
export const SNAPSHOT_MAX_AGE_HOURS = 6;

export interface SnapshotStation {
  level: number | null;
  updatedAt: number | null; // epoch ms, Bangkok wall-clock encoded via Date.UTC (see canalHistory.ts)
  warning: number | null;
  critical: number | null;
  history: { t: number; level: number }[];
}

interface SnapshotFile {
  fetchedAt: string | null;
  stations: Record<string, SnapshotStation>;
}

// `ms` is Bangkok wall-clock numbers encoded via Date.UTC (the same
// convention scripts/publish-snapshot.mjs and canalHistory.ts use for chart
// data) — i.e. it's 7h "ahead" of the true instant it represents. Convert
// to a real ISO string so timeAgoThai/formatBangkokDateTime (which expect a
// true instant) work correctly.
function bangkokMsToIso(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms - 7 * 3_600_000).toISOString();
}

export async function fetchSnapshot(): Promise<SnapshotFile> {
  const res = await resilientFetch(SNAPSHOT_URL, {
    headers: HEADERS,
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
  const snap: SnapshotFile = await res.json();
  if (!snap.fetchedAt) throw new Error("Snapshot not published yet");
  const ageHours = (Date.now() - new Date(snap.fetchedAt).getTime()) / 3_600_000;
  if (ageHours > SNAPSHOT_MAX_AGE_HOURS)
    throw new Error(`Snapshot too old (${ageHours.toFixed(1)}h)`);
  return snap;
}

async function fetchFromSnapshot(): Promise<CanalStation[]> {
  const snap = await fetchSnapshot();
  return STATIONS.map((s) => {
    const raw = snap.stations[String(s.bmaId)];
    const level = raw?.level ?? null;
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
      updatedAt: bangkokMsToIso(raw?.updatedAt ?? null),
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
  try {
    const stations = await fetchFromSnapshot();
    return { ok: true, stations, source: "snapshot" };
  } catch {
    // fall through to the relay, then ThaiWater
  }

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
