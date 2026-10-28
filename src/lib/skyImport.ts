/**
 * Parses and validates the two CSV files written by `collector.py --export`
 * (Stanford GPS Laboratory data). Pure functions so they can be unit-tested.
 */
export type SkyKind = "events" | "hexes";
export type EventRow = { type: "jamming" | "spoofing"; lat: number; lon: number; start_time: string; end_time: string };
export type HexRow = { hour: string; lat: number; lon: number; low_quality_count: number; total_count: number };

export const IMPORT_LIMITS = { maxBytes: 8_000_000, maxRows: 60_000 } as const;

const HEADERS: Record<SkyKind, string[]> = {
  events: ["type", "lat", "lon", "start_time", "end_time"],
  hexes: ["hour", "lat", "lon", "low_quality_count", "total_count"],
};

const isoOk = (s: string) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(s) && !Number.isNaN(Date.parse(s.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z"));
const iso = (s: string) => new Date(s.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(" ", "T") + "Z").toISOString();
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export type ParseResult<T> = { rows: T[]; errors: string[]; received: number };

export function parseSkyCsv(kind: "events", text: string): ParseResult<EventRow>;
export function parseSkyCsv(kind: "hexes", text: string): ParseResult<HexRow>;
export function parseSkyCsv(kind: SkyKind, text: string): ParseResult<EventRow | HexRow> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return { rows: [], errors: ["The file is empty."], received: 0 };
  const head = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const want = HEADERS[kind];
  if (want.some((h, i) => head[i] !== h)) {
    return { rows: [], errors: [`Expected the header "${want.join(",")}". Is this the ${kind === "events" ? "sky_events" : "sky_hexes"}.csv file?`], received: 0 };
  }
  const body = lines.slice(1);
  if (body.length > IMPORT_LIMITS.maxRows) return { rows: [], errors: [`Too many rows (${body.length}); the limit is ${IMPORT_LIMITS.maxRows} per import.`], received: body.length };

  const rows: (EventRow | HexRow)[] = [];
  const errors: string[] = [];
  const bad = (i: number, msg: string) => { if (errors.length < 20) errors.push(`Row ${i + 2}: ${msg}`); };
  body.forEach((line, i) => {
    const c = line.split(",").map((x) => x.trim());
    if (c.length !== want.length) return bad(i, `expected ${want.length} columns, found ${c.length}`);
    const lat = num(c[1]!), lon = num(c[2]!);
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) return bad(i, "latitude or longitude out of range");
    if (kind === "events") {
      const type = c[0]!.toLowerCase();
      if (type !== "jamming" && type !== "spoofing") return bad(i, `type must be jamming or spoofing`);
      if (!isoOk(c[3]!) || !isoOk(c[4]!)) return bad(i, "times must be ISO 8601 (e.g. 2026-10-01T14:00:00Z)");
      const start = iso(c[3]!), end = iso(c[4]!);
      if (end < start) return bad(i, "end_time is before start_time");
      if (Date.parse(end) - Date.parse(start) > 30 * 86400000) return bad(i, "an event longer than 30 days looks wrong");
      rows.push({ type, lat, lon, start_time: start, end_time: end });
    } else {
      if (!isoOk(c[0]!)) return bad(i, "hour must be ISO 8601");
      const low = num(c[3]!), total = num(c[4]!);
      if (!Number.isInteger(low) || !Number.isInteger(total) || low < 0 || total < 0 || total > 1_000_000) return bad(i, "counts must be whole numbers ≥ 0");
      if (low > total) return bad(i, "low_quality_count is larger than total_count");
      rows.push({ hour: iso(c[0]!), lat, lon, low_quality_count: low, total_count: total });
    }
  });
  return { rows, errors, received: body.length };
}

export const skyKey = (kind: SkyKind, r: EventRow | HexRow) =>
  kind === "events"
    ? `${(r as EventRow).type}|${r.lat.toFixed(5)}|${r.lon.toFixed(5)}|${new Date((r as EventRow).start_time).toISOString()}`
    : `${new Date((r as HexRow).hour).toISOString()}|${r.lat.toFixed(5)}|${r.lon.toFixed(5)}`;
