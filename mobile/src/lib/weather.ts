// Open-Meteo hava tahmini (ücretsiz, anahtar gerekmez). Telefon doğrudan çağırır.

export interface DayForecast {
  date: string; code: number; tMax: number; tMin: number; rainMm: number; rainChance: number | null; windKmh: number;
}
export interface Forecast { current: { temp: number; code: number; windKmh: number } | null; days: DayForecast[] }

export async function getForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&current=temperature_2m,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max' +
    '&timezone=Europe%2FIstanbul&forecast_days=7';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Hava durumu alınamadı.');
  const j = await res.json();
  const d = j.daily ?? {};
  const days: DayForecast[] = (d.time ?? []).map((date: string, i: number) => ({
    date,
    code: d.weather_code?.[i] ?? 0,
    tMax: d.temperature_2m_max?.[i] ?? 0,
    tMin: d.temperature_2m_min?.[i] ?? 0,
    rainMm: d.precipitation_sum?.[i] ?? 0,
    rainChance: d.precipitation_probability_max?.[i] ?? null,
    windKmh: d.wind_speed_10m_max?.[i] ?? 0,
  }));
  const c = j.current;
  return {
    current: c ? { temp: c.temperature_2m, code: c.weather_code, windKmh: c.wind_speed_10m } : null,
    days,
  };
}

// WMO hava kodları → Türkçe
export function weatherText(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: '☀️', text: 'Açık' };
  if (code <= 2) return { icon: '🌤️', text: 'Az bulutlu' };
  if (code === 3) return { icon: '☁️', text: 'Kapalı' };
  if (code === 45 || code === 48) return { icon: '🌫️', text: 'Sis' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: 'Çisenti' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', text: 'Yağmur' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', text: 'Kar' };
  if (code >= 80 && code <= 82) return { icon: '🌧️', text: 'Sağanak' };
  if (code === 85 || code === 86) return { icon: '🌨️', text: 'Kar sağanağı' };
  if (code >= 95) return { icon: '⛈️', text: 'Fırtına' };
  return { icon: '🌡️', text: '—' };
}

// Tarım için basit uyarılar
export function farmWarnings(days: DayForecast[]): string[] {
  const w: string[] = [];
  const next3 = days.slice(0, 3);
  if (next3.some((d) => d.tMin <= 0)) w.push('Önümüzdeki 3 günde don riski var.');
  if (next3.some((d) => d.rainMm >= 10)) w.push('Yoğun yağış bekleniyor; ilaçlama ve hasadı planlarken dikkat.');
  if (next3.some((d) => d.windKmh >= 40)) w.push('Kuvvetli rüzgâr bekleniyor; ilaçlama için uygun değil.');
  return w;
}
