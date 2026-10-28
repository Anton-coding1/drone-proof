import { describe, expect, it } from "vitest";
import { airspaceHits, frzParts, zoneShapes } from "@/lib/airspace";
import { PROTECTED_AERODROMES } from "@/lib/airspaceData";
import { assessRoute, DEFAULT_PROFILE, type LatLon, type RouteContext } from "@/lib/routeRisk";

const base: RouteContext = {
  start: new Date("2026-11-02T10:00:00Z"), durationMin: 20, hexes: [], events: [], activeVenues: [], spaceWeather: "quiet",
  denseHighRise: false, nearMajorRoads: false, gates: { notamRed: false, restrictedNoPermission: false, weatherOutside: false },
  areaOverride: "auto", consequenceOverride: "auto", lookbackDays: 30,
};
const prof = { ...DEFAULT_PROFILE, multiBand: true, flagsAndFailsafe: true };
const heathrow = PROTECTED_AERODROMES.find((a) => a.id === "EGLL")!;

describe("Aerodrome flight restriction zones", () => {
  it("Heathrow uses a 2.5 NM traffic zone and 1.5 km wide runway protection zones", () => {
    expect(heathrow.atzNm).toBe(2.5);
    expect(heathrow.rpzW).toBe(1.5);
    expect(frzParts(heathrow).filter((p) => p.kind === "rpz")).toHaveLength(4);
  });

  it("finds the traffic zone when a route crosses the airport", () => {
    const hits = airspaceHits([51.49, -0.52], [51.46, -0.4]);
    const h = hits.find((x) => x.id === "EGLL")!;
    expect(h.level).toBe("frz");
    expect(h.parts).toContain("traffic zone");
  });

  it("finds a runway protection zone beyond the traffic zone", () => {
    // About 5.8 km west of the airport centre, on the 09L centre line: outside the 4.6 km traffic zone, inside the RPZ.
    const hits = airspaceHits([51.4775, -0.546], [51.4776, -0.545]);
    const h = hits.find((x) => x.id === "EGLL")!;
    expect(h.parts).toEqual(["runway 09L protection zone"]);
  });

  it("does not flag a point well off the extended centre line", () => {
    expect(airspaceHits([51.5, -0.546], [51.5001, -0.545]).filter((x) => x.id === "EGLL")).toHaveLength(0);
  });

  it("leaves Greenwich Park and central London clear of aerodrome zones", () => {
    expect(airspaceHits([51.477, -0.001], [51.48, 0.005])).toHaveLength(0);
    expect(airspaceHits([51.5074, -0.1278], [51.5034, -0.087])).toHaveLength(0);
  });

  it("draws zones only near the map view", () => {
    const shapes = zoneShapes({ s: 51.45, w: -0.55, n: 51.55, e: -0.3 });
    expect(shapes.some((s) => s.id === "EGLL")).toBe(true);
    expect(shapes.some((s) => s.id === "EGPH")).toBe(false); // Edinburgh
  });
});

describe("Airspace in the pre-flight decision", () => {
  const route: LatLon[] = [[51.5268, -0.4606], [51.5105, -0.431], [51.496, -0.396], [51.485, -0.356], [51.4738, -0.3256]];

  it("a route through the Heathrow FRZ is NO-GO without permission, and says why", () => {
    const r = assessRoute(route, 0.5, base, prof)!;
    expect(r.decision).toBe("nogo");
    expect(r.airspace[0]!.name).toBe("Heathrow");
    expect(r.hardStops.join(" ")).toMatch(/Heathrow flight restriction zone/);
    expect(r.airspace[0]!.permission).toMatch(/nsf\.nats\.aero/);
  });

  it("with permission the airspace stop lifts and a condition is added", () => {
    const r = assessRoute(route, 0.5, { ...base, permissions: ["EGLL"] }, prof)!;
    expect(r.decision).not.toBe("nogo");
    expect(r.hardStops).toHaveLength(0);
    expect(r.conditions.join(" ")).toMatch(/Heathrow permission/);
  });

  it("flying above 120 m without an authorisation is a hard stop", () => {
    const pts: LatLon[] = [[52.2, -1.0], [52.21, -1.0]];
    expect(assessRoute(pts, 0.5, { ...base, maxHeightM: 150 }, prof)!.decision).toBe("nogo");
    expect(assessRoute(pts, 0.5, { ...base, maxHeightM: 150, heightAuthorised: true }, prof)!.decision).not.toBe("nogo");
  });

  it("the route result does not depend on the section length chosen", () => {
    const pts: LatLon[] = [[51.553, -0.285], [51.455, -0.02]];
    const p = [0.25, 0.5, 1, 2].map((km) => assessRoute(pts, km, base, prof)!.pRoute);
    for (const x of p) expect(Math.abs(x - p[0]!)).toBeLessThan(0.003);
  });
});
