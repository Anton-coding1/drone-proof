import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseFlightCsv } from "@/lib/csv";
import { analyse, type SkyEvent, type SkyHex } from "@/lib/evidence";

// The simulated aircraft data seeded in the demo database (drizzle/migrations/0000_migration.sql).
const HEXES: SkyHex[] = [
  { hour: "2026-10-01T14:00:00Z", lat: 51.5007, lon: -0.1246, low_quality_count: 0, total_count: 40 },
  { hour: "2026-09-16T10:00:00Z", lat: 69.29, lon: 16.03, low_quality_count: 0, total_count: 8 },
  { hour: "2026-09-20T15:00:00Z", lat: 54.38, lon: 18.47, low_quality_count: 14, total_count: 30 },
];
const EVENTS: SkyEvent[] = [{ type: "jamming", lat: 54.45, lon: 18.6, start_time: "2026-09-20T14:30:00Z", end_time: "2026-09-20T16:00:00Z" }];

function verdict(file: string) {
  const r = parseFlightCsv(readFileSync(`public/demo-data/${file}`, "utf8"));
  if ("error" in r) throw new Error(r.error);
  const hour = new Date(Math.floor(Date.parse(r.points[0]!.t) / 3600000) * 3600000).getTime();
  const hexes = HEXES.filter((h) => Date.parse(h.hour) === hour);
  return analyse(r.points as never, EVENTS, hexes).v.key;
}

describe("Demo flight logs land in each box of the finding table", () => {
  it.each([
    ["flight-london-clean.csv", "no-no"],
    ["flight-london-spoofed.csv", "yes-no"],
    ["flight-tromso-local-jammer.csv", "yes-no"],
    ["flight-gdansk-area-jamming.csv", "yes-yes"],
    ["flight-gdansk-drone-unaffected.csv", "no-yes"],
  ])("%s → %s", (file, key) => {
    expect(verdict(file)).toBe(key);
  });
});

import { assessRoute, DEFAULT_PROFILE, LONDON_VENUES, type LatLon } from "@/lib/routeRisk";

function route(file: string) {
  const lines = readFileSync(`public/demo-data/${file}`, "utf8").trim().split(/\r?\n/);
  const head = lines[0]!.split(",");
  const rows = lines.slice(1).map((l) => l.split(","));
  const pts = rows.map((r) => [Number(r[0]), Number(r[1])] as LatLon);
  const start = new Date(rows[0]![head.indexOf("planned_start")]!);
  const venue = head.includes("event_venue") ? rows[0]![head.indexOf("event_venue")] : undefined;
  const startHour = Math.floor(start.getTime() / 3600000) * 3600000;
  const hexes = HEXES.filter((h) => Date.parse(h.hour) <= startHour && Date.parse(h.hour) >= startHour - 30 * 86400000);
  const r = assessRoute(pts, 0.5, {
    start, durationMin: 20, hexes, events: EVENTS, activeVenues: LONDON_VENUES.filter((v) => v.id === venue),
    spaceWeather: "quiet", denseHighRise: false, nearMajorRoads: false, gates: { notamRed: false, restrictedNoPermission: false, weatherOutside: false },
    areaOverride: "auto", consequenceOverride: "auto", lookbackDays: 30,
  }, { ...DEFAULT_PROFILE, multiBand: true, flagsAndFailsafe: true })!;
  return r.decision;
}

describe("Demo routes give the decisions the demo page promises", () => {
  it.each([
    ["route-greenwich-park.csv", "go"],
    ["route-oxfordshire-survey.csv", "caution"],
    ["route-london-hospitals.csv", "nogo"],
    ["route-gdansk-bay.csv", "nogo"],
    ["route-wembley-match-day.csv", "caution"],
  ])("%s → %s", (file, d) => expect(route(file)).toBe(d));
  it("Wembley on match day is not GO with the default drone", () => {
    expect(route("route-wembley-match-day.csv")).not.toBe("go");
  });
});
