import { BMA_HEADERS } from "./canal";
import { resilientFetch } from "./resilientFetch";

const STATION_DETAIL_URL = (id: number) =>
  `https://weather.bangkok.go.th/water/StationDetail?id=${id}`;

export interface HistoryPoint {
  t: number; // epoch ms
  level: number;
}

export interface HistoryResult {
  ok: boolean;
  points: HistoryPoint[];
  error?: string;
}

const POINT_RE =
  /\[Date\.UTC\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\),\s*(-?[\d.]+)\]/g;

export async function fetchStationHistory(id: number): Promise<HistoryResult> {
  try {
    const res = await resilientFetch(STATION_DETAIL_URL(id), {
      headers: BMA_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const points: HistoryPoint[] = [];
    for (const m of html.matchAll(POINT_RE)) {
      const [, y, mo, d, h, mi, s, val] = m;
      // BMA embeds these as Date.UTC(year, monthIndex, day, hour, min, sec)
      // literals; the values are already Bangkok wall-clock time mislabeled
      // as UTC, so reconstructing with Date.UTC reproduces the same instant
      // the chart shows without a timezone conversion.
      points.push({
        t: Date.UTC(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s)),
        level: Number(val),
      });
    }

    if (points.length === 0)
      throw new Error("ไม่พบข้อมูลย้อนหลังของสถานีนี้ (รูปแบบหน้าเว็บอาจเปลี่ยน)");

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
