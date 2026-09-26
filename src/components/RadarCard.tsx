"use client";

import { useState } from "react";

const RADAR_SRC = "https://weather.bangkok.go.th/Images/Radar/radar.jpg";
const RADAR_PAGE = "https://weather.bangkok.go.th/water";

export default function RadarCard() {
  const [cacheBust] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-2xl font-bold text-gray-900">🗺️ เรดาร์ฝน กทม.</h2>
      <p className="mt-1 text-base text-gray-600">
        ภาพเรดาร์แสดงกลุ่มฝนล่าสุด (จุดสีแดง/ม่วง = ฝนตกหนัก)
      </p>

      {failed ? (
        <div className="mt-4 flex h-64 flex-col items-center justify-center gap-2 rounded-2xl bg-gray-100 text-center text-gray-500">
          <span className="text-4xl">⚠️</span>
          <p className="text-base">ตอนนี้ยังโหลดภาพเรดาร์ไม่ได้</p>
          <a
            href={RADAR_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            เปิดดูที่เว็บ กทม.
          </a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${RADAR_SRC}?v=${cacheBust}`}
          alt="ภาพเรดาร์ฝนล่าสุดของกรุงเทพมหานคร"
          className="mt-4 w-full rounded-2xl border border-gray-200 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </section>
  );
}
