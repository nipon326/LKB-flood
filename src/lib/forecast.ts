const LAT_KRABANG = { lat: 13.722, lon: 100.747 };

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT_KRABANG.lat}&longitude=${LAT_KRABANG.lon}` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
  `&current=temperature_2m,precipitation,weather_code` +
  `&timezone=Asia%2FBangkok&forecast_days=3`;

interface WeatherInfo {
  label: string;
  emoji: string;
}

// WMO weather codes, grouped for a Thai/rain-flood context.
function describeWeatherCode(code: number): WeatherInfo {
  if (code === 0) return { label: "แจ่มใส", emoji: "☀️" };
  if ([1, 2, 3].includes(code)) return { label: "มีเมฆบ้าง", emoji: "🌤️" };
  if ([45, 48].includes(code)) return { label: "มีหมอก", emoji: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code))
    return { label: "ฝนปรอยๆ", emoji: "🌦️" };
  if ([61, 63, 65].includes(code)) return { label: "ฝนตก", emoji: "🌧️" };
  if ([66, 67].includes(code)) return { label: "ฝนตก", emoji: "🌧️" };
  if ([80, 81, 82].includes(code))
    return { label: "ฝนตกเป็นช่วง", emoji: "🌧️" };
  if ([95, 96, 99].includes(code))
    return { label: "ฝนฟ้าคะนอง/ฝนหนัก", emoji: "⛈️" };
  return { label: "ไม่ทราบสภาพอากาศ", emoji: "❓" };
}

export interface DailyForecast {
  date: string;
  weekday: string;
  weather: WeatherInfo;
  tempMax: number;
  tempMin: number;
  rainMm: number;
  rainChance: number;
}

export interface CurrentWeather {
  tempC: number;
  rainMm: number;
  weather: WeatherInfo;
}

export interface ForecastResult {
  ok: boolean;
  current?: CurrentWeather;
  daily: DailyForecast[];
  error?: string;
}

const THAI_WEEKDAYS = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

function labelForDay(dateStr: string, index: number): string {
  if (index === 0) return "วันนี้";
  if (index === 1) return "พรุ่งนี้";
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return THAI_WEEKDAYS[d.getDay()];
}

export async function fetchForecast(): Promise<ForecastResult> {
  try {
    const res = await fetch(FORECAST_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const daily: DailyForecast[] = (data.daily?.time ?? []).map(
      (date: string, i: number) => ({
        date,
        weekday: labelForDay(date, i),
        weather: describeWeatherCode(data.daily.weather_code[i]),
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        rainMm: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
        rainChance: data.daily.precipitation_probability_max[i],
      })
    );

    const current: CurrentWeather | undefined = data.current
      ? {
          tempC: Math.round(data.current.temperature_2m),
          rainMm: data.current.precipitation,
          weather: describeWeatherCode(data.current.weather_code),
        }
      : undefined;

    return { ok: true, current, daily };
  } catch (err) {
    return {
      ok: false,
      daily: [],
      error: err instanceof Error ? err.message : "ดึงข้อมูลพยากรณ์อากาศไม่สำเร็จ",
    };
  }
}
