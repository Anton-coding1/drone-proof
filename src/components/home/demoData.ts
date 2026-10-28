import { DEFAULT_PROFILE, LONDON_VENUES, assessRoute, type DroneProfile, type LatLon, type RouteContext, type RouteResult } from "@/lib/routeRisk";
import type { SkyEvent, SkyHex } from "@/lib/evidence";

/** An illustrative route (Wembley Park → Northwick Park Hospital), assessed by the real pre-flight method. */
export const DEMO_ROUTE: LatLon[] = [[51.5634, -0.2795], [51.5671, -0.2938], [51.5712, -0.3069], [51.5755, -0.3215]];
export const DEMO_START = new Date("2026-10-20T15:00:00Z");
export const DEMO_WEMBLEY = LONDON_VENUES.find((v) => v.id === "wembley")!;
/** Where the illustrative military jamming trial is reported (about 27 km south-west, off the map). */
export const DEMO_TRIAL: LatLon = [51.45, -0.62];

export type ScenarioId = "ordinary" | "match" | "military" | "storm";
export const SCENARIOS: { id: ScenarioId; label: string; note: string }[] = [
  { id: "ordinary", label: "Ordinary day", note: "Quiet space weather, no events nearby and aircraft overhead all reporting healthy GPS." },
  { id: "match", label: "Match at Wembley", note: "Big events are often protected by counter-drone systems. Aircraft at altitude rarely notice them, so the event itself counts as a warning sign." },
  { id: "military", label: "Jamming trial", note: "A military jamming exercise 27 km away. Aircraft over the route have been reporting degraded GPS all week." },
  { id: "storm", label: "Solar storm", note: "A severe (G4) geomagnetic storm is forecast. It degrades satellite signals for every receiver, everywhere." },
];

export function demoSky(s: ScenarioId): { hexes: SkyHex[]; events: SkyEvent[] } {
  const hexes: SkyHex[] = [];
  for (let d = 1; d <= 20; d++) {
    const hour = new Date(DEMO_START.getTime() - d * 86400000).toISOString();
    for (const [lat, lon] of [[51.565, -0.29], [51.574, -0.315], [51.556, -0.27]] as LatLon[]) {
      hexes.push({ hour, lat, lon, total_count: 14, low_quality_count: s === "military" && d <= 6 ? 5 : 0 });
    }
  }
  const events: SkyEvent[] = s === "military"
    ? [{ type: "jamming", lat: DEMO_TRIAL[0], lon: DEMO_TRIAL[1], start_time: new Date(DEMO_START.getTime() - 8 * 3600000).toISOString(), end_time: new Date(DEMO_START.getTime() - 2 * 3600000).toISOString() }]
    : [];
  return { hexes, events };
}

export const DEMO_BASIC: DroneProfile = { ...DEFAULT_PROFILE };
export const DEMO_EQUIPPED: DroneProfile = { ...DEFAULT_PROFILE, multiBand: true, flagsAndFailsafe: true, deadReckoning: true, deadReckonLimitS: 30, timeToLandS: 25 };

export function runDemo(s: ScenarioId, equipped: boolean): RouteResult {
  const { hexes, events } = demoSky(s);
  const ctx: RouteContext = {
    start: DEMO_START, durationMin: 15, hexes, events,
    activeVenues: s === "match" ? [DEMO_WEMBLEY] : [],
    spaceWeather: s === "storm" ? "g4" : "quiet",
    denseHighRise: false, nearMajorRoads: false,
    gates: { notamRed: false, restrictedNoPermission: false, weatherOutside: false },
    areaOverride: "auto", consequenceOverride: "auto", lookbackDays: 30,
  };
  return assessRoute(DEMO_ROUTE, 0.5, ctx, equipped ? DEMO_EQUIPPED : DEMO_BASIC)!;
}
