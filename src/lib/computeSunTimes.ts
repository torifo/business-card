import SunCalc from "suncalc";
import type { Geo, SunTime } from "../types/card";

/**
 * ビルド時に呼ばれ、指定緯度経度における今日から `days` 日分の
 * 日の出/日没時刻 (UTC) を SunTime[] として返す。
 *
 * SunCalc は極地で sunrise/sunset を Invalid Date として返す場合がある。
 * その場合は同日の正午 UTC を両方に設定し、ランタイムの判定で常に
 * night-mode 側に倒れるようにする (safer default)。
 */
export function computeSunTimes(geo: Geo, days: number): SunTime[] {
  const out: SunTime[] = [];
  const start = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 86_400_000);
    const date = formatTzDate(day, geo.tz);
    const times = SunCalc.getTimes(day, geo.lat, geo.lng);
    const sunriseUTC = safeIso(times.sunrise) ?? noonUTC(day);
    const sunsetUTC = safeIso(times.sunset) ?? noonUTC(day);
    out.push({ date, sunriseUTC, sunsetUTC });
  }
  return out;
}

/**
 * 指定 IANA TZ における d の "YYYY-MM-DD" を返す。
 * en-CA ロケールは YYYY-MM-DD 形式を返すという挙動を利用している。
 */
export function formatTzDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function safeIso(d: Date): string | null {
  const t = d.getTime();
  return Number.isFinite(t) ? d.toISOString() : null;
}

function noonUTC(d: Date): string {
  const noon = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0),
  );
  return noon.toISOString();
}
