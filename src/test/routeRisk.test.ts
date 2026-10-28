import { describe, expect, it } from "vitest";
import {
  assessRoute, assessSection, betaQuantile, DEFAULT_PROFILE, LONDON_VENUES, splitRoute, vulnerability,
  type RouteContext,
} from "@/lib/routeRisk";
import type { SkyHex } from "@/lib/evidence";

const start = new Date("2026-10-15T15:00:00Z");
const oval = LONDON_VENUES.find((v) => v.id === "oval")!;
const mid: [number, number] = [oval.lat + 0.0135, oval.lon]; // ≈1.5 km north of The Oval

function cleanHexes(lat: number, lon: number, n = 500): SkyHex[] {
  return [{ hour: "2026-10-14T12:00:00Z", lat, lon, low_quality_count: 0, total_count: n }];
}

const base: RouteContext = {
  start, durationMin: 30, hexes: [], events: [], activeVenues: [], spaceWeather: "quiet",
  denseHighRise: false, nearMajorRoads: false,
  gates: { notamRed: false, restrictedNoPermission: false, weatherOutside: false },
  areaOverride: "auto", consequenceOverride: "auto", lookbackDays: 30,
};

describe("Pre-flight method v0.2", () => {
  it("Beta 90% upper bound behaves sensibly", () => {
    expect(betaQuantile(0.9, 1, 1)).toBeCloseTo(0.9, 3); // no data: very uncertain
    expect(betaQuantile(0.9, 1, 501)).toBeLessThan(0.006); // 500 clean reports: tight
  });

  it("reproduces the worked example: match day near a stadium → CAUTION (~1.4%)", () => {
    const { v } = vulnerability({ ...DEFAULT_PROFILE, multiBand: true, flagsAndFailsafe: true });
    expect(v).toBeCloseTo(0.49, 2);
    const r = assessSection(mid, {
      ...base, hexes: cleanHexes(mid[0], mid[1]), activeVenues: [oval], nearMajorRoads: true, consequenceOverride: "C3",
    }, v);
    expect(r.area).toBe("central");
    expect(r.pInt).toBeCloseTo(0.0293, 3);
    expect(r.pLoss).toBeCloseTo(0.0143, 3);
    expect(r.decision).toBe("caution");
  });

  it("never gives GO in a populated area when confidence is Low", () => {
    const r = assessSection([51.5074, -0.1278], { ...base }, 0.05);
    expect(r.confidence).toBe("Low");
    expect(r.rawDecision).toBe("go");
    expect(r.decision).toBe("caution");
  });

  it("gives GO for a capable drone over clean, sparse ground with good data", () => {
    const p: [number, number] = [52.2, -1.0];
    const r = assessSection(p, { ...base, hexes: cleanHexes(p[0], p[1]), consequenceOverride: "C1" }, 0.2);
    expect(r.confidence).toBe("Medium");
    expect(r.decision).toBe("go");
  });

  it("treats a handful of clean aircraft reports as no evidence, not as risk", () => {
    const p: [number, number] = [52.2, -1.0];
    const hexes: SkyHex[] = [{ hour: "2026-10-14T12:00:00Z", lat: p[0], lon: p[1], low_quality_count: 0, total_count: 8 }];
    const r = assessSection(p, { ...base, hexes, consequenceOverride: "C2" }, 1);
    expect(r.drivers.some((d) => d.label.startsWith("Aircraft"))).toBe(false);
    expect(r.confidence).toBe("Low");
  });

  it("hard gates force NO-GO", () => {
    const r = assessSection([52.2, -1.0], { ...base, consequenceOverride: "C1", gates: { notamRed: true, restrictedNoPermission: false, weatherOutside: false } }, 0.05);
    expect(r.decision).toBe("nogo");
  });

  it("heavily degraded aircraft data drives NO-GO", () => {
    const p: [number, number] = [54.38, 18.47];
    const hexes: SkyHex[] = [{ hour: "2026-10-15T14:00:00Z", lat: p[0], lon: p[1], low_quality_count: 40, total_count: 100 }];
    const r = assessSection(p, { ...base, hexes, consequenceOverride: "C2" }, 1);
    expect(r.decision).toBe("nogo");
  });

  it("splits a route into sections that add up to its length", () => {
    const pts: [number, number][] = [[51.4988, -0.1189], [51.5065, -0.11], [51.508, -0.098], [51.5034, -0.087]];
    const parts = splitRoute(pts, 1);
    expect(parts.length).toBe(3);
    expect(parts.reduce((a, s) => a + s.lengthKm, 0)).toBeCloseTo(2.82, 1);
  });

  it("route verdict is the worst section", () => {
    const pts: [number, number][] = [[52.2, -1.0], [52.21, -1.0], [52.22, -1.0]];
    const r = assessRoute(pts, 0.5, { ...base, consequenceOverride: "C1", hexes: cleanHexes(52.21, -1.0) }, { ...DEFAULT_PROFILE, deadReckoning: true, vlosPilot: true });
    expect(r).not.toBeNull();
    expect(r!.decision).toBe(r!.sections.map((s) => s.decision).includes("nogo") ? "nogo" : r!.sections.map((s) => s.decision).includes("caution") ? "caution" : "go");
  });
});
