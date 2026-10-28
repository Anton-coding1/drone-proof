import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { detect, describe as describeEvent, parseSensorCsv } from "@/lib/siteMonitor";

const load = (name: string) => {
  const r = parseSensorCsv(readFileSync(`public/demo-data/sensor-${name}.csv`, "utf8"));
  if ("error" in r) throw new Error(r.error);
  return r.epochs;
};

// Same answers as the Python sensor (data-engine/witnessmark_sensor.py simulate ... --seed 3).
describe("Site monitoring matches the ground sensor detector", () => {
  it("finds nothing on a quiet day or when a lorry blocks part of the sky", () => {
    expect(detect(load("quiet-day"))).toEqual([]);
    expect(detect(load("blocked-view"))).toEqual([]);
  });
  it("finds the jamming event with high confidence and the right times", () => {
    const ev = detect(load("jamming-event"));
    expect(ev.map((e) => [e.kind, e.confidence])).toEqual([["jamming", "High"]]);
    expect(new Date(ev[0]!.start * 1000).toISOString()).toBe("2026-09-21T15:07:20.000Z");
    expect(Math.round(ev[0]!.end - ev[0]!.start)).toBe(599);
    expect(describeEvent(ev[0]!).join(" ")).toMatch(/weaker/);
  });
  it("finds spoofing from the antenna appearing to move", () => {
    const ev = detect(load("spoofing-event"));
    expect(ev.map((e) => e.kind)).toEqual(["spoofing"]);
    expect(ev[0]!.evidence).toContain("offset");
    expect(new Date(ev[0]!.start * 1000).toISOString()).toBe("2026-09-21T15:07:39.000Z");
  });
  it("separates two different events in one log", () => {
    expect(detect(load("jamming-then-spoofing")).map((e) => e.kind)).toEqual(["jamming", "spoofing"]);
  });
  it("explains a bad file", () => {
    expect(parseSensorCsv("time,agc\n2026-01-01T00:00:00Z,1\n2026-01-01T00:00:01Z,1")).toEqual({ error: expect.stringMatching(/cno_top/) });
  });
});
