import { Incident } from "@/lib/incidents";
import { timeAgoThai } from "@/lib/status";

export default function IncidentCard({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-2xl font-bold text-gray-900">
        📍 สภาพรอบลาดกระบัง (แจ้งโดยประชาชน)
      </h2>
      <p className="mt-1 text-base text-gray-600">
        รายงานน้ำท่วม/ถนนในรัศมี 8 กม. จาก Longdo Traffic ช่วง 24 ชม.ที่ผ่านมา
      </p>

      {incidents.length === 0 ? (
        <p className="mt-4 text-gray-500">ยังไม่มีรายงานในช่วง 24 ชม.ที่ผ่านมา</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {incidents.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border border-gray-200 p-3"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-snug text-gray-900">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  ห่างบ้าน {item.distanceKm.toFixed(1)} กม. • {timeAgoThai(item.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
