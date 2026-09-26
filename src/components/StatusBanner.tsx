import {
  STATUS_META,
  Status,
  timeAgoThai,
  formatBangkokDateTime,
  isStale,
} from "@/lib/status";

interface Props {
  status: Status;
  updatedAt: string | null;
  criticalCount: number;
  totalCount: number;
}

const HEADLINE: Record<Status, string> = {
  normal: "สถานการณ์ปกติ",
  warning: "เฝ้าระวังระดับน้ำ",
  critical: "น้ำท่วม/วิกฤต",
  unknown: "ไม่มีข้อมูลระดับน้ำ",
};

export default function StatusBanner({
  status,
  updatedAt,
  criticalCount,
  totalCount,
}: Props) {
  const meta = STATUS_META[status];
  const detail =
    status === "critical" || status === "warning"
      ? `${criticalCount > 0 ? criticalCount : totalCount} จาก ${totalCount} จุดวัด ใกล้ลาดกระบัง`
      : `ทุกจุดวัดใกล้ลาดกระบัง (${totalCount} จุด) อยู่ในเกณฑ์ปกติ`;

  return (
    <div
      className="sticky top-0 z-10 border-b-4 px-5 py-5 sm:px-8"
      style={{ backgroundColor: meta.soft, borderColor: meta.solid }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-4xl"
          style={{ backgroundColor: meta.solid }}
          aria-hidden
        >
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <p
            className="text-2xl font-bold leading-tight sm:text-3xl"
            style={{ color: meta.text }}
          >
            {HEADLINE[status]}
          </p>
          <p className="mt-1 text-base text-gray-700 sm:text-lg">{detail}</p>
          <p className="mt-1 text-sm text-gray-500">
            ข้อมูลระดับน้ำล่าสุด: {formatBangkokDateTime(updatedAt)} (
            {timeAgoThai(updatedAt)})
          </p>
          {isStale(updatedAt) && (
            <p className="mt-1 text-sm font-semibold text-amber-700">
              ⚠️ ข้อมูลนี้อาจไม่ทันเหตุการณ์ ระบบต้นทางอาจ sync ล่าช้าช่วงน้ำท่วม
              — แนะนำเช็กซ้ำที่{" "}
              <a
                href="https://weather.bangkok.go.th/water"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                เว็บ กทม. โดยตรง
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
