/**
 * 初期テーマ即時適用 (Task 6.1 / FR-010 / NFR Offline)。
 *
 * - <head> 末尾に <script is:inline> として埋め込まれ、DOM 構築の早期に同期実行される
 * - <script id="card-data"> も同 <head> 内に配置されている前提
 * - sunTimes をパースし、現在時刻が今日の sunrise..sunset の間なら light-mode、
 *   それ以外なら night-mode を body に付与する (FOUC 防止)
 * - 今日のエントリが無い場合 (>365 日経過) は 06:00..18:00 の単純な
 *   フォールバックに切り替える
 *
 * IIFE で実行し、グローバルへの副作用は body のクラス付与のみに留める。
 */
(function initTheme() {
  type SunEntry = { date: string; sunriseUTC: string; sunsetUTC: string };
  type Embedded = { sunTimes: SunEntry[]; geo: { tz: string } };

  const dataEl = document.getElementById("card-data");
  if (!dataEl || !dataEl.textContent) {
    applyFallbackByHour();
    return;
  }

  let data: Embedded;
  try {
    data = JSON.parse(dataEl.textContent) as Embedded;
  } catch {
    applyFallbackByHour();
    return;
  }

  const todayKey = formatDateKey(new Date(), data.geo.tz);
  const entry = data.sunTimes.find((s) => s.date === todayKey);

  if (!entry) {
    applyFallbackByHour();
    return;
  }

  const now = Date.now();
  const sunrise = Date.parse(entry.sunriseUTC);
  const sunset = Date.parse(entry.sunsetUTC);

  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
    applyFallbackByHour();
    return;
  }

  const isDaytime = now >= sunrise && now <= sunset;
  applyMode(isDaytime ? "light-mode" : "night-mode");

  function applyMode(mode: "light-mode" | "night-mode"): void {
    document.body.classList.add(mode);
  }

  function applyFallbackByHour(): void {
    const h = new Date().getHours();
    applyMode(h >= 6 && h < 18 ? "light-mode" : "night-mode");
  }

  function formatDateKey(d: Date, tz: string): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
})();
