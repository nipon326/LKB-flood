import type { Status } from "./status";

const SUMMARY_URL = "https://weather.bangkok.go.th/water/Summary";

// Curated stations on/near Khlong Prawet Buri Rom around Lat Krabang,
// found by inspecting the `allData` dataset embedded in the BMA page above.
// Ordered roughly upstream -> downstream through Lat Krabang.
const STATIONS: { id: number; label: string; highlight?: boolean }[] = [
  { id: 298, label: "ปตร.คลองประเวศฯ - กรมชลประทาน" },
  { id: 39, label: "ปตร.คลองประเวศฯ - ลาดกระบัง" },
  { id: 64, label: "คลองประเวศฯ - รพ.ลาดกระบัง", highlight: true },
  { id: 65, label: "คลองประเวศฯ - ถ.ร่วมพัฒนา" },
  { id: 42, label: "คลองประเวศฯ - วัดขจรศิริ" },
  { id: 40, label: "ปตร.คลองประเวศฯ - วัดกระทุ่มเสือปลา" },
];

export interface CanalStation {
  id: number;
  label: string;
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
    const res = await fetch(SUMMARY_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (LKB-flood dashboard)" },
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
