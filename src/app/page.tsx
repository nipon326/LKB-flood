import { fetchCanalStations } from "@/lib/canal";
import { fetchForecast } from "@/lib/forecast";
import { fetchFloodNews } from "@/lib/news";
import { worstStatus } from "@/lib/status";
import StatusBanner from "@/components/StatusBanner";
import RadarCard from "@/components/RadarCard";
import CanalGauge from "@/components/CanalGauge";
import ForecastCard from "@/components/ForecastCard";
import NewsCard from "@/components/NewsCard";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 300;

export default async function Home() {
  // Kick off all three sources in parallel.
  const canalPromise = fetchCanalStations();
  const forecastPromise = fetchForecast();
  const newsPromise = fetchFloodNews();

  const [canal, forecast, news] = await Promise.all([
    canalPromise,
    forecastPromise,
    newsPromise,
  ]);

  const overallStatus = worstStatus(canal.stations.map((s) => s.status));
  const criticalCount = canal.stations.filter(
    (s) => s.status === "critical"
  ).length;
  const latestUpdate =
    canal.stations
      .map((s) => s.updatedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  return (
    <div className="min-h-screen bg-gray-100">
      <AutoRefresh />
      <StatusBanner
        status={overallStatus}
        updatedAt={latestUpdate}
        criticalCount={criticalCount}
        totalCount={canal.stations.length}
      />

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <RadarCard />

        <section>
          <h2 className="mb-3 text-2xl font-bold text-gray-900">
            💧 ระดับน้ำคลองประเวศฯ (ใกล้ลาดกระบัง)
          </h2>
          {!canal.ok && (
            <p className="mb-3 rounded-2xl bg-red-50 p-4 text-red-700">
              ดึงข้อมูลระดับน้ำไม่สำเร็จ: {canal.error}
            </p>
          )}
          <div className="space-y-4">
            {canal.stations.map((s) => (
              <CanalGauge key={s.id} station={s} />
            ))}
          </div>
        </section>

        <ForecastCard current={forecast.current} daily={forecast.daily} />

        <NewsCard items={news.items} />

        <p className="pb-4 text-center text-sm text-gray-400">
          หน้าจะรีเฟรชข้อมูลอัตโนมัติทุก 5 นาที • ข้อมูลจากสำนักการระบายน้ำ
          กทม., Open-Meteo และ Google News
        </p>
      </main>
    </div>
  );
}
