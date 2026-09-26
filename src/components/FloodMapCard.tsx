"use client";

import dynamic from "next/dynamic";
import { CanalStation } from "@/lib/canal";
import { ApproxLocation } from "@/lib/homeLocation";
import { STATUS_META, Status } from "@/lib/status";

const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
      กำลังโหลดแผนที่...
    </div>
  ),
});

const LEGEND_ORDER: Status[] = ["normal", "warning", "critical"];

export default function FloodMapCard({
  stations,
  home,
}: {
  stations: CanalStation[];
  home?: ApproxLocation | null;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-2xl font-bold text-gray-900">
        📍 แผนที่จุดวัดระดับน้ำใกล้บ้าน
      </h2>
      <p className="mt-1 text-base text-gray-600">
        แตะจุดสีเพื่อดูระดับน้ำของจุดนั้น
      </p>

      <div className="mt-4">
        <FloodMap stations={stations} home={home} />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-base">
        {home && (
          <span className="inline-flex items-center gap-1.5">
            🏠 {home.label}
          </span>
        )}
        {LEGEND_ORDER.map((s) => {
          const meta = STATUS_META[s];
          return (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-white"
                style={{ backgroundColor: meta.solid }}
              />
              {meta.emoji} {meta.label}
            </span>
          );
        })}
      </div>
      {home && (
        <p className="mt-2 text-sm text-gray-400">
          * ตำแหน่งบ้านบนแผนที่เป็นตำแหน่งโดยประมาณเท่านั้น
        </p>
      )}
    </section>
  );
}
