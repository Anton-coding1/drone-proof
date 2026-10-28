/**
 * Conditions the pre-flight check fills in by itself.
 *  - Weather forecast for the flight window: Open-Meteo (open-meteo.com, CC BY 4.0; free tier is non-commercial).
 *  - Major roads (motorway / trunk) and tall buildings near the route: OpenStreetMap via the Overpass API (ODbL).
 *  - Daylight: computed locally from the sun's position (no network).
 * Every function here is pure apart from the two fetchers, so the rules can be tested offline.
 */
export type LatLon = [number, number];

// ---------------------------------------------------------------- daylight
const RAD = Math.PI / 180;

/** Sun altitude in degrees (NOAA / Meeus low-precision formulae, accurate to well under 1°). */
export function sunAltitudeDeg(date: Date, lat: number, lon: number): number {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * RAD) - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

/** Sunrise and sunset (sun's upper edge on the horizon, −0.833°) on the UTC day containing `date`. */
export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date | null; sunset: Date | null } {
  const day0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  let sunrise: Date | null = null, sunset: Date | null = null;
  let prev = sunAltitudeDeg(new Date(day0), lat, lon) > -0.833;
  for (let m = 1; m <= 1440; m++) {
    const t = new Date(day0 + m * 60000);
    const up = sunAltitudeDeg(t, lat, lon) > -0.833;
    if (up && !prev && !sunrise) sunrise = t;
    if (!up && prev && !sunset) sunset = t;
    prev = up;
  }
  return { sunrise, sunset };
}

/**
 * UK legal night (Air Navigation Order): from 30 minutes after sunset until 30 minutes before sunrise.
 * Returns whether any part of the flight window is at night, plus the day's sunrise and sunset.
 */
export function daylight(start: Date, durationMin: number, at: LatLon) {
  const cache = new Map<string, ReturnType<typeof sunTimes>>();
  const times = (t: Date) => { const k = t.toISOString().slice(0, 10); if (!cache.has(k)) cache.set(k, sunTimes(t, at[0], at[1])); return cache.get(k)!; };
  const { sunrise, sunset } = times(start);
  let night = false;
  for (let m = 0; m <= durationMin; m += 5) {
    const t = new Date(start.getTime() + m * 60000);
    const { sunrise: sr, sunset: ss } = times(t);
    if (!sr || !ss) { night = sunAltitudeDeg(t, at[0], at[1]) < -0.833; if (night) break; continue; }
    if (t.getTime() > ss.getTime() + 30 * 60000 || t.getTime() < sr.getTime() - 30 * 60000) { night = true; break; }
  }
  return { night, sunrise, sunset };
}

// ---------------------------------------------------------------- weather
export type WeatherHour = { time: string; wind10: number | null; wind80: number | null; gust: number | null; precip: number | null; visibility: number | null; temp: number | null };
export type WeatherWorst = { wind: number | null; gust: number | null; precip: number | null; visibility: number | null; tempMin: number | null; tempMax: number | null; hours: number };
export type WeatherLimits = { maxWindMs: number; rainRated: boolean };

/** Points to sample for weather: start, middle and end of the route (fewer if the route is short). */
export function weatherSamplePoints(points: LatLon[]): LatLon[] {
  if (!points.length) return [];
  const first = points[0]!, last = points[points.length - 1]!, mid = points[Math.floor(points.length / 2)]!;
  const km = (a: LatLon, b: LatLon) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos(a[0] * RAD));
  if (km(first, last) < 3 && km(first, mid) < 3) return [first];
  return [first, mid, last];
}

export function worstWeather(hours: WeatherHour[]): WeatherWorst {
  const max = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.max(...v) : null; };
  const min = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.min(...v) : null; };
  return {
    wind: max(hours.map((h) => (h.wind80 ?? h.wind10))), gust: max(hours.map((h) => h.gust)), precip: max(hours.map((h) => h.precip)),
    visibility: min(hours.map((h) => h.visibility)), tempMin: min(hours.map((h) => h.temp)), tempMax: max(hours.map((h) => h.temp)), hours: hours.length,
  };
}

/** Plain-language reasons the forecast is outside the drone's limits (empty = within limits). */
export function weatherReasons(w: WeatherWorst, lim: WeatherLimits): string[] {
  const r: string[] = [];
  const windAtHeight = Math.max(w.wind ?? 0, w.gust ?? 0);
  if (windAtHeight > lim.maxWindMs) r.push(`Forecast wind up to ${windAtHeight.toFixed(0)} m/s (gusts included) is above your drone's ${lim.maxWindMs} m/s limit.`);
  if ((w.precip ?? 0) >= 0.5 && !lim.rainRated) r.push(`Rain forecast (${(w.precip ?? 0).toFixed(1)} mm/h) and the drone isn't rated for rain.`);
  if (w.visibility != null && w.visibility < 1000) r.push(`Visibility forecast below 1 km (${Math.round(w.visibility)} m): hard to keep the drone in sight.`);
  if (w.tempMin != null && w.tempMin < -10) r.push(`Temperature down to ${w.tempMin.toFixed(0)} °C, below most drones' −10 °C limit.`);
  if (w.tempMax != null && w.tempMax > 40) r.push(`Temperature up to ${w.tempMax.toFixed(0)} °C, above most drones' 40 °C limit.`);
  return r;
}

const hourIso = (d: Date) => d.toISOString().slice(0, 13) + ":00";

export function parseOpenMeteo(json: unknown): WeatherHour[] {
  const h = (json as { hourly?: Record<string, unknown[]> })?.hourly;
  if (!h || !Array.isArray(h["time"])) return [];
  const n = (k: string, i: number) => { const v = (h[k] as unknown[] | undefined)?.[i]; return typeof v === "number" ? v : null; };
  return (h["time"] as string[]).map((time, i) => ({
    time, wind10: n("wind_speed_10m", i), wind80: n("wind_speed_80m", i), gust: n("wind_gusts_10m", i),
    precip: n("precipitation", i), visibility: n("visibility", i), temp: n("temperature_2m", i),
  }));
}

export async function fetchWeather(points: LatLon[], start: Date, durationMin: number): Promise<{ hours: WeatherHour[]; worst: WeatherWorst; fetchedAt: string }> {
  const from = new Date(Math.floor(start.getTime() / 3600000) * 3600000);
  const to = new Date(Math.floor((start.getTime() + durationMin * 60000) / 3600000) * 3600000);
  const all: WeatherHour[] = [];
  await Promise.all(weatherSamplePoints(points).map(async ([lat, lon]) => {
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lon.toFixed(4), timezone: "UTC", wind_speed_unit: "ms",
      hourly: "wind_speed_10m,wind_speed_80m,wind_gusts_10m,precipitation,visibility,temperature_2m",
      start_hour: hourIso(from), end_hour: hourIso(to),
    }).toString();
    const res = await fetch(u.toString());
    if (!res.ok) throw new Error("Weather forecast unavailable for that time");
    all.push(...parseOpenMeteo(await res.json()));
  }));
  if (!all.length) throw new Error("No forecast for that time (forecasts cover about the next two weeks)");
  return { hours: all, worst: worstWeather(all), fetchedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------- roads & tall buildings (OpenStreetMap)
export type Road = { id: number; name: string; kind: string; line: LatLon[] };
export type MapFeatures = { roads: Road[]; tallBuildings: LatLon[]; fetchedAt: string };
export const ROAD_RADIUS_M = 300;
export const BUILDING_RADIUS_M = 150;
export const HIGH_RISE_MIN = 8;

/** Up to `max` points along the route, evenly spread, for the Overpass line filter. */
export function thinRoute(points: LatLon[], max = 40): LatLon[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]!);
}

/** Densify long legs so the Overpass "around a line" filter follows the route closely. */
function densify(points: LatLon[], maxKm = 2): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i) {
      const a = points[i - 1]!;
      const km = Math.hypot((p[0] - a[0]) * 111, (p[1] - a[1]) * 111 * Math.cos(a[0] * RAD));
      const n = Math.ceil(km / maxKm);
      for (let s = 1; s < n; s++) out.push([a[0] + ((p[0] - a[0]) * s) / n, a[1] + ((p[1] - a[1]) * s) / n]);
    }
    out.push(p);
  }
  return out;
}

export function overpassQuery(points: LatLon[]): string {
  const line = thinRoute(densify(points), 60).map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(",");
  return `[out:json][timeout:20];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link)$"](around:${ROAD_RADIUS_M},${line});
out geom 400;
way["building"](if: (is_number(t["building:levels"]) && number(t["building:levels"]) >= 10) || (is_number(t["height"]) && number(t["height"]) >= 35))(around:${BUILDING_RADIUS_M},${line});
out center 300;`;
}

type OsmEl = { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; center?: { lat: number; lon: number } };

export function parseOverpass(json: unknown): Omit<MapFeatures, "fetchedAt"> {
  const els = ((json as { elements?: OsmEl[] })?.elements ?? []).filter((e) => e.type === "way");
  const roads: Road[] = [];
  const tallBuildings: LatLon[] = [];
  for (const e of els) {
    const t = e.tags ?? {};
    if (t["highway"] && e.geometry?.length) {
      const kind = t["highway"].replace("_link", "");
      roads.push({ id: e.id, kind, name: [t["ref"], t["name"]].filter(Boolean).join(" ") || (kind === "motorway" ? "Motorway" : "Trunk road"), line: e.geometry.map((g) => [g.lat, g.lon] as LatLon) });
    } else if (t["building"] && e.center) tallBuildings.push([e.center.lat, e.center.lon]);
  }
  return { roads, tallBuildings };
}

/** Distinct road names for display, e.g. "M4, A4 Bath Road". */
export function roadNames(roads: Road[], max = 4): string {
  const names = [...new Set(roads.map((r) => r.name))];
  return names.slice(0, max).join(", ") + (names.length > max ? ` and ${names.length - max} more` : "");
}

export async function fetchMapFeatures(points: LatLon[]): Promise<MapFeatures> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: overpassQuery(points) }).toString(),
  });
  if (!res.ok) throw new Error("OpenStreetMap lookup unavailable");
  return { ...parseOverpass(await res.json()), fetchedAt: new Date().toISOString() };
}
