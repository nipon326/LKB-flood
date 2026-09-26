import { CurrentWeather, DailyForecast } from "@/lib/forecast";

export default function ForecastCard({
  current,
  daily,
}: {
  current?: CurrentWeather;
  daily: DailyForecast[];
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-2xl font-bold text-gray-900">
        🌦️ ฝนใกล้บ้าน &amp; พยากรณ์ 3 วัน
      </h2>

      {current && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-sky-50 p-4">
          <span className="text-5xl" aria-hidden>
            {current.weather.emoji}
          </span>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {current.weather.label}
            </p>
            <p className="text-lg text-gray-600">
              {current.tempC}°C &nbsp;•&nbsp; ฝน 15 นาทีล่าสุด {current.rainMm} มม.
            </p>
            {daily[0] && (
              <p className="mt-1 text-lg font-semibold text-blue-700">
                ☔ ฝนสะสมวันนี้ {daily[0].rainMm} มม.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {daily.map((d) => (
          <div
            key={d.date}
            className="rounded-2xl border border-gray-200 p-4 text-center"
          >
            <p className="text-lg font-semibold text-gray-800">{d.weekday}</p>
            <p className="mt-1 text-4xl" aria-hidden>
              {d.weather.emoji}
            </p>
            <p className="text-base text-gray-600">{d.weather.label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {d.tempMax}° / {d.tempMin}°
            </p>
            <p className="mt-1 text-base text-blue-700">
              ☔ {d.rainChance}% • {d.rainMm} มม.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
