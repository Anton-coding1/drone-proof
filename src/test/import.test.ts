import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: new Headers() }) }));
import { parseSkyCsv, skyKey } from "@/lib/skyImport";
import { secretMatches } from "@/lib/security.server";
import { wellKnownResponse } from "@/lib/wellKnown";

describe("Aircraft data import", () => {
  it("accepts the collector's events export", () => {
    const r = parseSkyCsv("events", "type,lat,lon,start_time,end_time\njamming,51.5,-0.1,2026-10-01T14:00:00Z,2026-10-01T16:00:00Z\nspoofing,54.2,18.9,2026-10-02 09:00:00,2026-10-02 10:00:00\n");
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]!.start_time).toBe("2026-10-02T09:00:00.000Z");
  });
  it("rejects bad rows with a reason and keeps good ones", () => {
    const r = parseSkyCsv("hexes", "hour,lat,lon,low_quality_count,total_count\n2026-10-01T14:00:00Z,51.5,-0.1,2,10\n2026-10-01T14:00:00Z,99,-0.1,2,10\n2026-10-01T14:00:00Z,51.5,-0.1,12,10\nnot-a-date,51.5,-0.1,1,10\n=cmd|' /C calc'!A0,1,1,1,1\n");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(4);
  });
  it("refuses the wrong file", () => {
    const r = parseSkyCsv("events", "hour,lat,lon,low_quality_count,total_count\n");
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/sky_events/);
  });
  it("treats the same place and time as a duplicate whatever the timestamp format", () => {
    const a = skyKey("hexes", { hour: "2026-10-01T14:00:00Z", lat: 51.5, lon: -0.1, low_quality_count: 0, total_count: 1 });
    const b = skyKey("hexes", { hour: "2026-10-01T14:00:00+00:00", lat: 51.500001, lon: -0.1, low_quality_count: 3, total_count: 9 });
    expect(a).toBe(b);
  });
});

describe("Secrets and public files", () => {
  it("compares secrets correctly and never matches an empty secret", async () => {
    expect(await secretMatches("a-long-operator-token-123456", "a-long-operator-token-123456")).toBe(true);
    expect(await secretMatches("a-long-operator-token-123457", "a-long-operator-token-123456")).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
  });
  it("serves robots, sitemap and security.txt with absolute URLs", async () => {
    const u = (p: string) => new URL(`https://witnessmark.example${p}`);
    const robots = await wellKnownResponse(u("/robots.txt"))!.text();
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Sitemap: https://witnessmark.example/sitemap.xml");
    const sm = await wellKnownResponse(u("/sitemap.xml"))!.text();
    expect(sm).toContain("<loc>https://witnessmark.example/pre-flight/check</loc>");
    expect(sm).not.toContain("/analysis");
    expect(sm).not.toContain("/admin");
    const sec = await wellKnownResponse(u("/.well-known/security.txt"))!.text();
    expect(sec).toMatch(/^Contact: mailto:/);
    expect(sec).toMatch(/Expires: 20\d\d-/);
    expect(wellKnownResponse(u("/anything"))).toBeNull();
  });
});
