export type Status = "normal" | "warning" | "critical" | "unknown";

// Hex values picked (and contrast-checked against white) so the status is
// never carried by hue alone: every use pairs this with the Thai label + emoji.
export const STATUS_META: Record<
  Status,
  { label: string; emoji: string; solid: string; text: string; soft: string }
> = {
  normal: {
    label: "ปกติ",
    emoji: "🟢",
    solid: "#0ca30c",
    text: "#006300",
    soft: "#eafbea",
  },
  warning: {
    label: "เฝ้าระวัง",
    emoji: "🟡",
    solid: "#fab219",
    text: "#7a4a00",
    soft: "#fff4e0",
  },
  critical: {
    label: "วิกฤต",
    emoji: "🔴",
    solid: "#d03b3b",
    text: "#921f1f",
    soft: "#fdeaea",
  },
  unknown: {
    label: "ไม่มีข้อมูล",
    emoji: "⚪",
    solid: "#9ca3af",
    text: "#4b5563",
    soft: "#f3f4f6",
  },
};

export function statusRank(s: Status): number {
  return { unknown: 0, normal: 1, warning: 2, critical: 3 }[s];
}

export function worstStatus(list: Status[]): Status {
  if (list.length === 0) return "unknown";
  return list.reduce((worst, s) =>
    statusRank(s) > statusRank(worst) ? s : worst
  );
}

export function timeAgoThai(iso: string | null): string {
  if (!iso) return "ไม่ทราบเวลา";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "ไม่ทราบเวลา";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} วันที่แล้ว`;
}

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

// Absolute Bangkok-local timestamp, e.g. "25 ก.ย. 20:05 น." — shown
// alongside the relative time so a stale reading is never mistaken for
// live, since our upstream data source can lag by hours under load.
export function formatBangkokDateTime(iso: string | null): string {
  if (!iso) return "ไม่ทราบเวลา";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "ไม่ทราบเวลา";
  // iso carries an explicit +07:00 offset, so the UTC getters here read
  // back the original Bangkok wall-clock values.
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${hh}:${mm} น.`;
}

// Data older than this is flagged as possibly stale rather than presented
// as current.
const STALE_THRESHOLD_MIN = 120;

export function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return true;
  return (Date.now() - then) / 60000 > STALE_THRESHOLD_MIN;
}
