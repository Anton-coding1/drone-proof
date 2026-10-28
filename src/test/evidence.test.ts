import { describe, expect, it } from "vitest";
import { analyse, type Point, type SkyEvent, type SkyHex } from "@/lib/evidence";
import { parseFlightCsv, sha256Hex, toCsv } from "@/lib/csv";

/** Recreates the 9 handover test files: 300 rows, one per second. */
function flight(opts: {
  lat?: number; lon?: number; start?: string;
  jam?: [number, number]; accDrop?: [number, number]; jump?: [number, number]; flags?: boolean;
}): Point[] {
  const { lat = 51.5007, lon = -0.1246, start = "2026-10-01T14:00:00Z", flags = true } = opts;
  const t0 = new Date(start).getTime();
  const pts: Point[] = [];
  for (let s = 0; s < 300; s++) {
    const inJam = opts.jam && s >= opts.jam[0] && s <= opts.jam[1];
    const inDrop = opts.accDrop && s >= opts.accDrop[0] && s <= opts.accDrop[1];
    const inJump = opts.jump && s >= opts.jump[0] && s <= opts.jump[1];
    pts.push({
      t: new Date(t0 + s * 1000).toISOString(),
      lat: lat + 0.0015 * Math.sin(s / 48) + (inJump ? 0.02 : 0),
      lon: lon + 0.0025 * Math.sin(s / 96),
      accuracy_m: inJam ? 20 + (s % 20) : inDrop ? 15 + (s % 20) : 0.8 + (s % 7) * 0.1,
      satellites: inJam ? 3 + (s % 4) : inDrop ? 4 + (s % 4) : 16 + (s % 5),
      jamming_state: flags ? (inJam ? 3 : 1) : null,
      spoofing_state: flags ? 1 : null,
    });
  }
  return pts;
}

const londonSky: SkyHex[] = [{ hour: "2026-10-01T14:00:00Z", lat: 51.5007, lon: -0.1246, low_quality_count: 0, total_count: 40 }];
const balticSky: SkyHex[] = [{ hour: "2026-09-20T15:00:00Z", lat: 54.38, lon: 18.47, low_quality_count: 14, total_count: 30 }];
const balticEvent: SkyEvent[] = [{ type: "jamming", lat: 54.45, lon: 18.6, start_time: "2026-09-20T14:30:00Z", end_time: "2026-09-20T16:00:00Z" }];

describe("Evidence engine — the 9 handover test files", () => {
  it("01 clean London flight → no evidence, High", () => {
    const a = analyse(flight({}), [], londonSky);
    expect(a.v.key).toBe("no-no");
    expect(a.v.confidence).toBe("High");
  });

  it("02 London jamming flags → likely local, Medium (E1 and E2 fire)", () => {
    const a = analyse(flight({ jam: [120, 239] }), [], londonSky);
    expect(a.v.key).toBe("yes-no");
    expect(a.v.confidence).toBe("Medium");
    expect(a.drone.rules.find((r) => r.id === "E1")!.result).toBe("met");
    expect(a.drone.rules.find((r) => r.id === "E2")!.result).toBe("met");
  });

  it("03 no flag columns + accuracy drop → E1 not available, E2 fires, likely local", () => {
    const a = analyse(flight({ accDrop: [150, 239], flags: false }), [], londonSky);
    expect(a.drone.rules.find((r) => r.id === "E1")!.result).toBe("na");
    expect(a.drone.rules.find((r) => r.id === "E2")!.result).toBe("met");
    expect(a.v.key).toBe("yes-no");
  });

  it("04 position jump → E3 only, likely local", () => {
    const a = analyse(flight({ jump: [180, 199] }), [], londonSky);
    const fired = a.drone.rules.filter((r) => r.fired).map((r) => r.id);
    expect(fired).toEqual(["E3"]);
    expect(a.v.key).toBe("yes-no");
  });

  it("05 Baltic confirmed → external interference, High", () => {
    const a = analyse(flight({ lat: 54.38, lon: 18.47, start: "2026-09-20T15:00:00Z", jam: [60, 299] }), balticEvent, balticSky);
    expect(a.v.key).toBe("yes-yes");
    expect(a.v.confidence).toBe("High");
  });

  it("06 no sky data → no evidence, Medium (capped)", () => {
    const a = analyse(flight({ lat: 57.8, lon: -5.1, start: "2026-10-05T03:00:00Z" }), [], []);
    expect(a.sky.status).toBe("unknown");
    expect(a.v.confidence).toBe("Medium");
    expect(a.v.lean).toBe("clean");
  });

  it("07 missing lat column → clear error", () => {
    const r = parseFlightCsv("t,lon,alt_m,satellites,accuracy_m,fix_type\n2026-10-01T14:00:00Z,-0.12,50,17,1,3\n2026-10-01T14:00:01Z,-0.12,50,17,1,3");
    expect("error" in r && r.error).toMatch(/Missing required column: lat/);
  });

  it("08 not a flight log → clear error", () => {
    const r = parseFlightCsv("hello world\nthis is not a log\nat all");
    expect("error" in r).toBe(true);
  });

  it("09 tampered copy of 01 → same finding, different fingerprint", async () => {
    const pts = flight({});
    const rows = pts.map((p) => ({ ...p, alt_m: 60, fix_type: 3 }));
    const original = toCsv(rows);
    const tampered = original.replace(/,60,/, ",61,");
    const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
    expect(await sha256Hex(enc(original))).not.toBe(await sha256Hex(enc(tampered)));
    const a = parseFlightCsv(tampered);
    expect("points" in a).toBe(true);
    if ("points" in a) expect(analyse(a.points, [], londonSky).v.key).toBe("no-no");
  });
});

describe("Evidence engine — method v0.4 rules", () => {
  it("ignores aircraft readings more than 60 km away", () => {
    const farHex: SkyHex[] = [{ hour: "2026-10-01T14:00:00Z", lat: 48.85, lon: 2.35, low_quality_count: 20, total_count: 40 }];
    expect(analyse(flight({}), [], farHex).sky.status).toBe("unknown");
  });

  it("counts an overlapping event even when few aircraft were overhead", () => {
    const fewPlanes: SkyHex[] = [{ ...balticSky[0]!, total_count: 2, low_quality_count: 0 }];
    const a = analyse(flight({ lat: 54.38, lon: 18.47, start: "2026-09-20T15:00:00Z" }), balticEvent, fewPlanes);
    expect(a.sky.status).toBe("yes");
    expect(a.v.key).toBe("no-yes");
  });

  it("gives Low confidence when the log has no GPS quality fields", () => {
    const bare = flight({ flags: false }).map((p) => ({ ...p, accuracy_m: null, satellites: null }));
    const a = analyse(bare, [], londonSky);
    expect(a.v.confidence).toBe("Low");
  });

  it("parses a CSV without the optional alarm columns", () => {
    const r = parseFlightCsv("t,lat,lon,alt_m,satellites,accuracy_m,fix_type\n2026-10-01T14:00:00Z,51.5,-0.12,50,17,1.1,3\n2026-10-01T14:00:01Z,51.5,-0.12,50,17,1.0,3");
    expect("points" in r && r.points.length).toBe(2);
  });
});
