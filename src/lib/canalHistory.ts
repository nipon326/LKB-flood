import { resilientFetch } from "./resilientFetch";
import { STATIONS, fetchSnapshot } from "./canal";

const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

export interface HistoryPoint {
  t: number; // epoch ms (Bangkok wall-clock stored via Date.UTC, see below)
  level: number;
}

export interface HistoryResult {
  ok: boolean;
  points: HistoryPoint[];
  error?: string;
}

// Same snapshot file as canal.ts reads for current levels — fetched again
// here per station, but Next.js memoizes identical fetch() calls within a
// single render, so this doesn't cost 6 separate network requests.
async function fetchFromSnapshot(bmaId: number): Promise<HistoryPoint[]> {
  const snap = await fetchSnapshot();
  const points = snap.stations[String(bmaId)]?.history ?? [];
  if (points.length === 0) throw new Error("No history in snapshot for this station");
  return points;
}

async function fetchFromRelay(
  baseUrl: string,
  bmaId: number
): Promise<HistoryPoint[]> {
  const res = await resilientFetch(
    `${baseUrl.replace(/\/$/, "")}/history?id=${bmaId}`,
    { headers: HEADERS, next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`Relay HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Relay returned an error");
  const points: HistoryPoint[] = json.points ?? [];
  if (points.length === 0) throw new Error("Relay returned no history points");
  return points;
}

// Bangkok-local calendar date (YYYY-MM-DD), independent of the server's own
// timezone, since this only sets the query's day range.
function bangkokDateStr(d: Date): string {
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

async function fetchFromThaiWater(thaiwaterId: number): Promise<HistoryPoint[]> {
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const url =
    `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph` +
    `?station_type=canal&station_id=${thaiwaterId}` +
    `&start_date=${bangkokDateStr(start)}&end_date=${bangkokDateStr(now)}`;

  const res = await resilientFetch(url, {
    headers: HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`ThaiWater HTTP ${res.status}`);
  const json = await res.json();
  const raw: { datetime: string; value: number | null }[] =
    json?.data?.graph_data ?? [];

  const points: HistoryPoint[] = [];
  for (const p of raw) {
    if (p.value === null) continue;
    const m = p.datetime.match(DATE_RE);
    if (!m) continue;
    const [, y, mo, d, h, mi] = m;
    // Same convention as the rest of the app: Bangkok wall-clock numbers
    // stored via Date.UTC, read back with UTC getters for display.
    points.push({
      t: Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)),
      level: p.value,
    });
  }
  if (points.length === 0)
    throw new Error("ไม่พบข้อมูลย้อนหลังของสถานีนี้ในช่วง 2 วันที่ผ่านมา");
  points.sort((a, b) => a.t - b.t);
  return points;
}

// `bmaId` is weather.bangkok.go.th's water_id (the canonical id used
// elsewhere in the app).
export async function fetchStationHistory(bmaId: number): Promise<HistoryResult> {
  const station = STATIONS.find((s) => s.bmaId === bmaId);

  try {
    const points = await fetchFromSnapshot(bmaId);
    return { ok: true, points };
  } catch {
    // fall through to the relay, then ThaiWater
  }

  const relayBase = process.env.RELAY_BASE_URL;
  if (relayBase) {
    try {
      const points = await fetchFromRelay(relayBase, bmaId);
      return { ok: true, points };
    } catch {
      // fall through to ThaiWater
    }
  }

  try {
    if (!station) throw new Error("Unknown station id");
    const points = await fetchFromThaiWater(station.thaiwaterId);
    return { ok: true, points };
  } catch (err) {
    return {
      ok: false,
      points: [],
      error: err instanceof Error ? err.message : "ดึงข้อมูลย้อนหลังไม่สำเร็จ",
    };
  }
}
