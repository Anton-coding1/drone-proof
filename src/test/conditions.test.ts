import { describe, expect, it } from "vitest";
import { daylight, parseOpenMeteo, parseOverpass, sunTimes, weatherReasons, worstWeather, overpassQuery, roadNames } from "@/lib/conditions";
import { assessRoute, DEFAULT_PROFILE, type RouteContext } from "@/lib/routeRisk";

const LONDON: [number, number] = [51.5074, -0.1278];

describe("Daylight", () => {
  it("finds London sunrise and sunset on 28 October 2026 within a few minutes", () => {
    const { sunrise, sunset } = sunTimes(new Date("2026-10-28T12:00:00Z"), ...LONDON);
    // Reference (astral library): sunrise 06:47, sunset 16:40 UTC.
    expect(Math.abs(sunrise!.getTime() - Date.parse("2026-10-28T06:47:00Z"))).toBeLessThan(3 * 60000);
    expect(Math.abs(sunset!.getTime() - Date.parse("2026-10-28T16:40:30Z"))).toBeLessThan(3 * 60000);
  });
  it("uses the UK legal definition of night (30 minutes after sunset)", () => {
    expect(daylight(new Date("2026-10-28T12:00:00Z"), 20, LONDON).night).toBe(false);
    expect(daylight(new Date("2026-10-28T16:50:00Z"), 15, LONDON).night).toBe(false); // twilight, not yet night
    expect(daylight(new Date("2026-10-28T20:00:00Z"), 20, LONDON).night).toBe(true);
    expect(daylight(new Date("2026-10-28T16:50:00Z"), 40, LONDON).night).toBe(true); // runs past sunset + 30 min
  });
});

describe("Weather", () => {
  const json = { hourly: { time: ["2026-10-28T20:00"], wind_speed_10m: [6], wind_speed_80m: [9.5], wind_gusts_10m: [13], precipitation: [0.8], visibility: [24000], temperature_2m: [9] } };
  it("parses the Open-Meteo response", () => {
    expect(parseOpenMeteo(json)[0]).toMatchObject({ wind80: 9.5, gust: 13, precip: 0.8 });
  });
  it("flags wind over the drone's limit and rain for a drone that isn't rain-rated", () => {
    const w = worstWeather(parseOpenMeteo(json));
    const r = weatherReasons(w, { maxWindMs: 10, rainRated: false });
    expect(r.join(" ")).toMatch(/13 m\/s/);
    expect(r.join(" ")).toMatch(/Rain/);
    expect(weatherReasons(w, { maxWindMs: 15, rainRated: true })).toHaveLength(0);
  });
});

describe("OpenStreetMap features", () => {
  it("builds a line query and parses roads and tall buildings", () => {
    const q = overpassQuery([[51.5, -0.45], [51.48, -0.30]]);
    expect(q).toMatch(/around:300,51\.50000,-0\.45000/);
    const f = parseOverpass({ elements: [
      { type: "way", id: 1, tags: { highway: "motorway", ref: "M4" }, geometry: [{ lat: 51.49, lon: -0.4 }, { lat: 51.49, lon: -0.38 }] },
      { type: "way", id: 2, tags: { highway: "trunk", ref: "A4", name: "Bath Road" }, geometry: [{ lat: 51.48, lon: -0.4 }, { lat: 51.48, lon: -0.39 }] },
      { type: "way", id: 3, tags: { building: "yes", "building:levels": "20" }, center: { lat: 51.5, lon: -0.1 } },
    ] });
    expect(f.roads).toHaveLength(2);
    expect(roadNames(f.roads)).toBe("M4, A4 Bath Road");
    expect(f.tallBuildings).toEqual([[51.5, -0.1]]);
  });
});

describe("Conditions in the decision", () => {
  const base: RouteContext = {
    start: new Date("2026-10-28T20:00:00Z"), durationMin: 20, hexes: [], events: [], activeVenues: [], spaceWeather: "quiet",
    denseHighRise: false, nearMajorRoads: false, gates: { notamRed: false, restrictedNoPermission: false, weatherOutside: false },
    areaOverride: "auto", consequenceOverride: "C1", lookbackDays: 30,
  };
  const pts: [number, number][] = [[52.2, -1.0], [52.21, -1.0]];
  it("weather outside limits is a hard stop that names the reason", () => {
    const r = assessRoute(pts, 0.5, { ...base, gates: { ...base.gates, weatherOutside: true }, weatherReasons: ["Forecast wind up to 14 m/s is above your drone's 10 m/s limit."] }, DEFAULT_PROFILE)!;
    expect(r.decision).toBe("nogo");
    expect(r.hardStops[0]).toMatch(/14 m\/s/);
  });
  it("at night the 'pilot flying by eye' credit is not applied", () => {
    const prof = { ...DEFAULT_PROFILE, vlosPilot: true };
    const day = assessRoute(pts, 0.5, base, prof)!, night = assessRoute(pts, 0.5, { ...base, night: true }, prof)!;
    expect(night.v).toBeGreaterThan(day.v);
    expect(night.conditions.join(" ")).toMatch(/Night flight/);
  });
});
