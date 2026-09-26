import { fetchCanalStations } from "@/lib/canal";
import { fetchStationHistory } from "@/lib/canalHistory";
import { fetchForecast } from "@/lib/forecast";
import { fetchFloodNews } from "@/lib/news";
import { approximateHomeLocation } from "@/lib/homeLocation";
import { worstStatus } from "@/lib/status";
import StatusBanner from "@/components/StatusBanner";
import RadarCard from "@/components/RadarCard";
import FloodMapCard from "@/components/FloodMapCard";
import CanalGauge from "@/components/CanalGauge";
import ForecastCard from "@/components/ForecastCard";
import NewsCard from "@/components/NewsCard";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 300;

// The station right by Lat Krabang Hospital, closest to home — this is the
// one that gets the historical chart.
const HOME_STATION_ID = 64;

export default async function Home() {
  // Kick off all sources in parallel.
  const canalPromise = fetchCanalStations();
  const historyPromise = fetchStationHistory(HOME_STATION_ID);
  const forecastPromise = fetchForecast();
  const newsPromise = fetchFloodNews();

  const [canal, history, forecast, news] = await Promise.all([
    canalPromise,
    historyPromise,
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
  const home = approximateHomeLocation();

  return (
    <div className="min-h-screen bg-gray-100">
      <AutoRefresh />
      <StatusBanner
        status={overallStatus}
        updatedAt={latestUpdate}
        criticalCount={criticalCount}
        totalCount={canal.stations.length}
      />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <FloodMapCard stations={canal.stations} home={home} />
            <RadarCard />
          </div>

          <section>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              💧 ระดับน้ำคลองประเวศฯ ใกล้บ้าน
            </h2>
            {!canal.ok && (
              <p className="mb-3 rounded-2xl bg-red-50 p-4 text-red-700">
                ดึงข้อมูลระดับน้ำไม่สำเร็จ: {canal.error}
              </p>
            )}
            <div className="space-y-4">
              {canal.stations.map((s) => (
                <CanalGauge
                  key={s.id}
                  station={s}
                  history={
                    s.id === HOME_STATION_ID ? history.points : undefined
                  }
                />
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <ForecastCard current={forecast.current} daily={forecast.daily} />
          <NewsCard items={news.items} />
        </div>

        <p className="pb-4 text-center text-sm text-gray-400">
          หน้าจะรีเฟรชข้อมูลอัตโนมัติทุก 5 นาที • ข้อมูลจากสำนักการระบายน้ำ
          กทม., Open-Meteo และ Google News
        </p>
      </main>
    </div>
  );
}
