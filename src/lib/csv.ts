export const REQUIRED = ["t", "lat", "lon", "alt_m", "satellites", "accuracy_m", "fix_type"] as const;
export const OPTIONAL = ["jamming_state", "spoofing_state"] as const;
export const ALL = [...REQUIRED, ...OPTIONAL];

export type ParsedPoint = {
  t: string; lat: number; lon: number; alt_m: number | null; satellites: number | null;
  accuracy_m: number | null; fix_type: number | null; jamming_state: number | null; spoofing_state: number | null;
};

export function parseFlightCsv(text: string): { points: ParsedPoint[] } | { error: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return { error: "The file needs a header row and at least two data rows." };
  const delim = [",", ";", "\t"].map((d) => [d, lines[0]!.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const header = lines[0]!.split(delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${ALL.join(", ")}.` };
  const idx = Object.fromEntries(ALL.map((c) => [c, header.indexOf(c)]));
  const points: ParsedPoint[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r]!.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (c: string) => (idx[c]! >= 0 ? cells[idx[c]!] ?? "" : "");
    const num = (c: string) => { const v = get(c); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
    const t = get("t");
    const d = new Date(t);
    if (!t || isNaN(d.getTime())) return { error: `Row ${r + 1}: "t" must be an ISO timestamp (e.g. 2026-10-01T14:00:00Z).` };
    const p = {
      t: d.toISOString(), lat: num("lat"), lon: num("lon"), alt_m: num("alt_m"), satellites: num("satellites"),
      accuracy_m: num("accuracy_m"), fix_type: num("fix_type"), jamming_state: num("jamming_state"), spoofing_state: num("spoofing_state"),
    };
    for (const [k, v] of Object.entries(p)) if (typeof v === "number" && isNaN(v)) return { error: `Row ${r + 1}: "${k}" is not a number.` };
    if (p.lat === null || p.lon === null || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return { error: `Row ${r + 1}: lat/lon missing or out of range.` };
    for (const k of ["satellites", "fix_type", "jamming_state", "spoofing_state"] as const) if (p[k] !== null) p[k] = Math.round(p[k]!);
    points.push(p as ParsedPoint);
  }
  if (points.length > 20000) return { error: "File too large: maximum 20,000 rows." };
  points.sort((a, b) => a.t.localeCompare(b.t));
  return { points };
}

export function toCsv(rows: Record<string, unknown>[]) {
  return [ALL.join(","), ...rows.map((r) => ALL.map((c) => r[c] ?? "").join(","))].join("\n");
}

export async function sha256Hex(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
