import { resilientFetch } from "./resilientFetch";

const GRAPH_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph";
const HEADERS = { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" };

export interface HistoryPoint {
  t: number; // epoch ms (Bangkok wall-clock stored via Date.UTC — see canalHistory formatting note below)
  level: number;
}

export interface HistoryResult {
  ok: boolean;
  points: HistoryPoint[];
  error?: string;
}

// Bangkok-local calendar date (YYYY-MM-DD), independent of the server's own
// timezone, since this only sets the query's day range.
function bangkokDateStr(d: Date): string {
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export async function fetchStationHistory(id: number): Promise<HistoryResult> {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
    const url =
      `${GRAPH_URL}?station_type=canal&station_id=${id}` +
      `&start_date=${bangkokDateStr(start)}&end_date=${bangkokDateStr(now)}`;

    const res = await resilientFetch(url, {
      headers: HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    return { ok: true, points };
  } catch (err) {
    return {
      ok: false,
      points: [],
      error: err instanceof Error ? err.message : "ดึงข้อมูลย้อนหลังไม่สำเร็จ",
    };
  }
}
