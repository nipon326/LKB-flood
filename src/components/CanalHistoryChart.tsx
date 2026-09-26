import { HistoryPoint } from "@/lib/canalHistory";
import { STATUS_META } from "@/lib/status";

interface Props {
  points: HistoryPoint[];
  warning: number | null;
  critical: number | null;
  label: string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 18, right: 14, bottom: 28, left: 46 };

// These timestamps are Bangkok wall-clock numbers stored via Date.UTC (see
// canalHistory.ts), so they must be read back with the UTC getters — using
// local time here would shift the displayed hours.
function formatTime(t: number): string {
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDayTime(t: number): string {
  const d = new Date(t);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${formatTime(t)}`;
}

export default function CanalHistoryChart({
  points,
  warning,
  critical,
  label,
}: Props) {
  if (points.length < 2) {
    return <p className="mt-4 text-gray-500">ยังไม่มีข้อมูลย้อนหลังเพียงพอสำหรับกราฟ</p>;
  }

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const levels = points.map((p) => p.level);
  const dataMin = Math.min(...levels);
  const dataMax = Math.max(...levels);

  const yMax = Math.max(dataMax, critical ?? dataMax) * 1.15 || 1;
  const yMin = Math.min(0, dataMin);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (t: number) =>
    PAD.left + ((t - tMin) / (tMax - tMin || 1)) * plotW;
  const y = (v: number) =>
    PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.level).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const seriesColor = "#2a78d6"; // sequential blue: this is a measured value, not a status

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`กราฟระดับน้ำย้อนหลังของ ${label} ตั้งแต่ ${formatDayTime(tMin)} ถึง ${formatDayTime(tMax)} ล่าสุด ${last.level.toFixed(2)} เมตร`}
      >
        {/* recessive gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = yMin + f * (yMax - yMin);
          return (
            <line
              key={f}
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
          );
        })}

        {/* warning / critical reference lines */}
        {warning !== null && warning >= yMin && warning <= yMax && (
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(warning)}
            y2={y(warning)}
            stroke={STATUS_META.warning.solid}
            strokeWidth={1.5}
            strokeDasharray="5,4"
          />
        )}
        {critical !== null && critical >= yMin && critical <= yMax && (
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(critical)}
            y2={y(critical)}
            stroke={STATUS_META.critical.solid}
            strokeWidth={1.5}
            strokeDasharray="5,4"
          />
        )}

        {/* the level line */}
        <path d={linePath} fill="none" stroke={seriesColor} strokeWidth={2.5} strokeLinecap="round" />

        {/* end point + direct label */}
        <circle cx={x(last.t)} cy={y(last.level)} r={4.5} fill={seriesColor} />

        {/* y-axis labels */}
        <text x={4} y={y(yMax) + 4} fontSize="11" fill="#898781">
          {yMax.toFixed(1)}ม.
        </text>
        <text x={4} y={y(yMin)} fontSize="11" fill="#898781">
          {yMin.toFixed(1)}ม.
        </text>

        {/* x-axis labels: start / end */}
        <text x={PAD.left} y={HEIGHT - 8} fontSize="11" fill="#898781">
          {formatDayTime(tMin)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
          fontSize="11"
          fill="#898781"
          textAnchor="end"
        >
          {formatDayTime(tMax)}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
        <span>
          <span className="inline-block h-2 w-4 rounded" style={{ backgroundColor: seriesColor }} />{" "}
          ระดับน้ำ (สูงสุด {dataMax.toFixed(2)} ม. / ต่ำสุด {dataMin.toFixed(2)} ม.)
        </span>
        {warning !== null && (
          <span>
            <span
              className="inline-block h-2 w-4 rounded"
              style={{ backgroundColor: STATUS_META.warning.solid }}
            />{" "}
            เฝ้าระวัง {warning.toFixed(2)} ม.
          </span>
        )}
        {critical !== null && (
          <span>
            <span
              className="inline-block h-2 w-4 rounded"
              style={{ backgroundColor: STATUS_META.critical.solid }}
            />{" "}
            วิกฤต {critical.toFixed(2)} ม.
          </span>
        )}
      </div>
    </div>
  );
}
