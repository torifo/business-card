/**
 * 10 分ごとに日没/日の出をまたいだか再判定し、必要に応じて
 * body.light-mode <-> body.night-mode を入れ替える (Task 6.2 / FR-010)。
 *
 * 初期適用は theme-init.inline.ts が担当する。この module は import
 * された時点で setInterval を仕掛けるだけで、即時実行はしない。
 * 手動切替 UI は持たない (FR-010 Auto オンリー)。
 */

interface SunEntry {
  date: string;
  sunriseUTC: string;
  sunsetUTC: string;
}
interface Embedded {
  sunTimes: SunEntry[];
  geo: { tz: string };
}

const REEVAL_MS = 10 * 60 * 1000;

function reevaluate(): void {
  const dataEl = document.getElementById("card-data");
  if (!dataEl?.textContent) return;

  let data: Embedded;
  try {
    data = JSON.parse(dataEl.textContent) as Embedded;
  } catch {
    return;
  }

  const todayKey = formatDateKey(new Date(), data.geo.tz);
  const entry = data.sunTimes.find((s) => s.date === todayKey);
  if (!entry) return;

  const now = Date.now();
  const sunrise = Date.parse(entry.sunriseUTC);
  const sunset = Date.parse(entry.sunsetUTC);
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return;

  const isDaytime = now >= sunrise && now <= sunset;
  const next = isDaytime ? "light-mode" : "night-mode";
  const prev = isDaytime ? "night-mode" : "light-mode";

  if (document.body.classList.contains(next)) return;
  document.body.classList.remove(prev);
  document.body.classList.add(next);
}

function formatDateKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

setInterval(reevaluate, REEVAL_MS);
