import { fetchCanalStations, STATIONS } from "@/lib/canal";
import { fetchStationHistory, HistoryPoint } from "@/lib/canalHistory";
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

// ISR (time-based revalidate) got stuck serving a stale page for over a
// day in production — the forecast's "today" kept showing the previous
// day, which is exactly the kind of bug a flood dashboard can't have.
// force-dynamic renders fresh on every request instead of trusting the
// background-revalidation cache; traffic here is low enough (a couple of
// tablets, refreshed every 5 min client-side) that the extra compute is
// free, and correctness matters far more than shaving that cost.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Kick off all sources in parallel, including one history fetch per
  // station so every canal gets its own trend chart.
  const canalPromise = fetchCanalStations();
  const historyPromises = Promise.all(
    STATIONS.map(async (s) => [s.bmaId, await fetchStationHistory(s.bmaId)] as const)
  );
  const forecastPromise = fetchForecast();
  const newsPromise = fetchFloodNews();

  const [canal, historyEntries, forecast, news] = await Promise.all([
    canalPromise,
    historyPromises,
    forecastPromise,
    newsPromise,
  ]);
  const historyById = new Map<number, HistoryPoint[]>(
    historyEntries.map(([id, result]) => [id, result.points])
  );

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
        <FloodMapCard stations={canal.stations} home={home} />

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <RadarCard />
            <ForecastCard current={forecast.current} daily={forecast.daily} />
            <NewsCard items={news.items} />
          </div>

          <section>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              💧 ระดับน้ำคลองรอบบ้าน
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
                  history={historyById.get(s.id)}
                />
              ))}
            </div>
          </section>
        </div>

        <p className="pb-4 text-center text-sm text-gray-400">
          หน้าจะรีเฟรชข้อมูลอัตโนมัติทุก 5 นาที • ข้อมูลจากสำนักการระบายน้ำ
          กทม., Open-Meteo และ Google News
        </p>
      </main>
    </div>
  );
}
