import { describe, it, expect } from "vitest";
import { computeSunTimes, formatTzDate } from "./computeSunTimes";
import type { Geo } from "../types/card";

const TOKYO: Geo = { lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" };
const EQUATOR: Geo = { lat: 0, lng: 0, tz: "UTC" };
const HIGH_ARCTIC: Geo = { lat: 80, lng: 0, tz: "UTC" };

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("formatTzDate", () => {
  it("returns YYYY-MM-DD for Asia/Tokyo", () => {
    // 2026-05-22 12:00 UTC = 2026-05-22 21:00 JST → still 2026-05-22
    const d = new Date("2026-05-22T12:00:00Z");
    expect(formatTzDate(d, "Asia/Tokyo")).toBe("2026-05-22");
  });

  it("rolls over to the next JST day when UTC time crosses midnight JST", () => {
    // 2026-05-22 16:00 UTC = 2026-05-23 01:00 JST
    const d = new Date("2026-05-22T16:00:00Z");
    expect(formatTzDate(d, "Asia/Tokyo")).toBe("2026-05-23");
  });
});

describe("computeSunTimes (Tokyo)", () => {
  const out = computeSunTimes(TOKYO, 365);

  it("returns exactly the requested number of entries", () => {
    expect(out).toHaveLength(365);
  });

  it("uses YYYY-MM-DD date keys", () => {
    for (const entry of out) {
      expect(entry.date).toMatch(DATE_KEY_RE);
    }
  });

  it("emits ISO 8601 UTC timestamps for sunrise and sunset", () => {
    for (const entry of out) {
      expect(entry.sunriseUTC).toMatch(ISO_UTC_RE);
      expect(entry.sunsetUTC).toMatch(ISO_UTC_RE);
    }
  });

  it("produces consecutive calendar days (no gaps, no duplicates)", () => {
    for (let i = 1; i < out.length; i++) {
      const prev = new Date(out[i - 1].date + "T00:00:00Z").getTime();
      const cur = new Date(out[i].date + "T00:00:00Z").getTime();
      expect(cur - prev).toBe(86_400_000);
    }
  });

  it("places sunrise before sunset on each day", () => {
    for (const entry of out) {
      const sunrise = new Date(entry.sunriseUTC).getTime();
      const sunset = new Date(entry.sunsetUTC).getTime();
      expect(sunrise).toBeLessThan(sunset);
    }
  });
});

describe("computeSunTimes (equator)", () => {
  it("returns ~12 hours of daylight year-round at the equator", () => {
    const out = computeSunTimes(EQUATOR, 30);
    for (const entry of out) {
      const sunrise = new Date(entry.sunriseUTC).getTime();
      const sunset = new Date(entry.sunsetUTC).getTime();
      const hours = (sunset - sunrise) / (1000 * 60 * 60);
      // 赤道では年間を通じて 11〜13 時間の昼夜
      expect(hours).toBeGreaterThan(11);
      expect(hours).toBeLessThan(13);
    }
  });
});

describe("computeSunTimes (polar fallback)", () => {
  it("falls back to noon UTC when SunCalc returns Invalid Date (sunrise=sunset)", () => {
    const out = computeSunTimes(HIGH_ARCTIC, 365);
    // 80°N では夏至付近で white night、冬至付近で polar night が生じ
    // SunCalc が Invalid Date を返す。フォールバックは sunrise === sunset (= noon UTC) となる。
    const polarFallbackCount = out.filter(
      (e) => e.sunriseUTC === e.sunsetUTC,
    ).length;
    expect(polarFallbackCount).toBeGreaterThan(0);
  });

  it("polar fallback emits valid ISO 8601 UTC strings", () => {
    const out = computeSunTimes(HIGH_ARCTIC, 365);
    for (const entry of out) {
      expect(entry.sunriseUTC).toMatch(ISO_UTC_RE);
      expect(entry.sunsetUTC).toMatch(ISO_UTC_RE);
    }
  });
});
