import { CanalStation } from "@/lib/canal";
import { HistoryPoint } from "@/lib/canalHistory";
import { STATUS_META, timeAgoThai, formatBangkokDateTime, isStale } from "@/lib/status";
import CanalHistoryChart from "./CanalHistoryChart";

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export default function CanalGauge({
  station,
  history,
}: {
  station: CanalStation;
  history?: HistoryPoint[];
}) {
  const meta = STATUS_META[station.status];
  const { level, warning, critical } = station;
  const hasData = level !== null && warning !== null && critical !== null;

  const max = hasData
    ? Math.max(critical! * 1.4, level! * 1.15, 0.3)
    : 1;
  const levelPct = hasData ? pct(level!, max) : 0;
  const warningPct = hasData ? pct(warning!, max) : 0;
  const criticalPct = hasData ? pct(critical!, max) : 0;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          {station.highlight && (
            <span className="mb-1 inline-block rounded-full bg-blue-100 px-3 py-0.5 text-sm font-semibold text-blue-700">
              ใกล้บ้าน
            </span>
          )}
          <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">
            {station.label}
          </h3>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-base font-semibold whitespace-nowrap"
          style={{ backgroundColor: meta.soft, color: meta.text }}
        >
          {meta.emoji} {meta.label}
        </span>
      </div>

      {!hasData ? (
        <p className="mt-4 text-gray-500">ไม่มีข้อมูลจากสถานีนี้ในขณะนี้</p>
      ) : (
        <div className="mt-5 flex items-center gap-6">
          {/* Water-level "tube" */}
          <div className="relative h-44 w-14 shrink-0 rounded-2xl bg-gray-100 ring-1 ring-inset ring-gray-200">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-2xl transition-all"
              style={{ height: `${levelPct}%`, backgroundColor: meta.solid }}
            />
            {/* critical line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed"
              style={{
                bottom: `${criticalPct}%`,
                borderColor: STATUS_META.critical.solid,
              }}
            />
            {/* warning line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed"
              style={{
                bottom: `${warningPct}%`,
                borderColor: STATUS_META.warning.solid,
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-4xl font-bold text-gray-900">
              {level!.toFixed(2)}{" "}
              <span className="text-lg font-medium text-gray-500">เมตร</span>
            </p>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>
                <span
                  className="mr-1 inline-block h-2 w-4 rounded"
                  style={{ backgroundColor: STATUS_META.warning.solid }}
                />
                เส้นเฝ้าระวัง {warning!.toFixed(2)} ม.
              </p>
              <p>
                <span
                  className="mr-1 inline-block h-2 w-4 rounded"
                  style={{ backgroundColor: STATUS_META.critical.solid }}
                />
                เส้นวิกฤต {critical!.toFixed(2)} ม.
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              ข้อมูล {formatBangkokDateTime(station.updatedAt)} (
              {timeAgoThai(station.updatedAt)})
            </p>
            {isStale(station.updatedAt) && (
              <p className="mt-1 text-sm font-semibold text-amber-700">
                ⚠️ ข้อมูลอาจไม่ทันเหตุการณ์
              </p>
            )}
          </div>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="text-lg font-semibold text-gray-800">
            ระดับน้ำย้อนหลัง 2 วัน
          </h4>
          <CanalHistoryChart
            points={history}
            warning={warning}
            critical={critical}
            label={station.label}
          />
        </div>
      )}
    </div>
  );
}
