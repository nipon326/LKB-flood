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
