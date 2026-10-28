/**
 * Site monitoring — Ground sensor detection method v0.1, running in the browser.
 * A direct port of data-engine/sensor/detector.py: learn what normal looks like at the
 * site, then flag moments when several independent signs of interference appear together.
 */

export type Epoch = {
  t: number;                 // UNIX seconds, UTC
  fix: number;               // 0 none, 2 = 2D, 3 = 3D
  numSv: number;
  hAccM: number | null;
  cnoTop: number | null;     // mean C/N0 (dB-Hz) of the strongest satellites above 15°
  satsTracked: number;
  agc: number | null;
  jamInd: number | null;
  jamState: number;          // 0 unknown, 1 ok, 2 warning, 3 critical
  spoofState: number;        // 0 unknown, 1 none, 2 indicated, 3 multiple
  lat: number | null;
  lon: number | null;
};

export type EvidenceCode = "cno_drop" | "no_sats" | "agc" | "jam_ind" | "rx_jam" | "fix_lost" | "rx_spoof" | "offset" | "cno_rise";

export type SiteEvent = {
  kind: "jamming" | "spoofing";
  start: number; end: number;
  confidence: "High" | "Medium" | "Low";
  evidence: EvidenceCode[];
  peakCnoDropDb: number; peakCnoRiseDb: number; peakAgcShift: number; peakJamIndRise: number; maxOffsetM: number;
  closedByGap: boolean;
};

export const SETTINGS = {
  warmupMinutes: 30, baselineMinutes: 360, minOnS: 5, minOffS: 30, gapS: 10,
  cnoDropDb: 4, cnoRiseDb: 4, agcShift: 0.15, jamIndRise: 15, offsetM: 30, offsetStrongM: 100, goodHaccM: 5,
} as const;

export const SENSOR_COLUMNS = ["time", "fix", "num_sv", "h_acc_m", "cno_top", "sats_tracked", "agc", "jam_ind", "jam_state", "spoof_state", "lat", "lon"] as const;
const REQUIRED_COLS = ["time", "cno_top"] as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};
const mad = (xs: number[], c: number) => (xs.length ? 1.4826 * median(xs.map((x) => Math.abs(x - c))) : 0);
function haversineM(a: number, b: number, c: number, d: number) {
  const r = 6371000, p1 = (a * Math.PI) / 180, p2 = (c * Math.PI) / 180, dp = p2 - p1, dl = ((d - b) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

type Stat = { c: number; spread: number };

class Baseline {
  minutes: [number, number, number][] = [];
  private bucket: Epoch[] = [];
  private bucketMinute: number | null = null;
  private pos: [number, number][] = [];
  refLat: number | null = null;
  refLon: number | null = null;
  private cached: Partial<Record<"cno" | "agc" | "jam", Stat>> = {};

  addClean(e: Epoch) {
    const m = Math.floor(e.t / 60);
    if (this.bucketMinute !== null && m !== this.bucketMinute) this.flush();
    this.bucketMinute = m;
    this.bucket.push(e);
    if (this.refLat === null && e.fix >= 3 && e.lat !== null && e.lon !== null && e.hAccM !== null && e.hAccM <= SETTINGS.goodHaccM) {
      this.pos.push([e.lat, e.lon]);
      if (this.pos.length >= 1800) {
        this.refLat = median(this.pos.map((p) => p[0]));
        this.refLon = median(this.pos.map((p) => p[1]));
        this.pos = [];
      }
    }
  }

  private flush() {
    const b = this.bucket;
    const cno = b.map((x) => x.cnoTop).filter((x): x is number => x !== null);
    const agc = b.map((x) => x.agc).filter((x): x is number => x !== null);
    const ji = b.map((x) => x.jamInd).filter((x): x is number => x !== null);
    if (cno.length) {
      this.minutes.push([median(cno), agc.length ? median(agc) : NaN, ji.length ? median(ji) : NaN]);
      if (this.minutes.length > SETTINGS.baselineMinutes) this.minutes.shift();
      this.recompute();
    }
    this.bucket = [];
  }

  private recompute() {
    const out: Partial<Record<"cno" | "agc" | "jam", Stat>> = {};
    (["cno", "agc", "jam"] as const).forEach((name, i) => {
      const xs = this.minutes.map((m) => m[i]!).filter((x) => !Number.isNaN(x));
      if (xs.length) { const c = median(xs); out[name] = { c, spread: mad(xs, c) }; }
    });
    this.cached = out;
  }

  get ready() { return this.minutes.length >= SETTINGS.warmupMinutes; }
  stats() { return this.ready ? this.cached : {}; }
}

type Signals = { jam: number; spoof: number; codes: EvidenceCode[]; cnoDrop: number; agcShift: number; jamRise: number; offset: number };

export class Detector {
  base = new Baseline();
  open: SiteEvent | null = null;
  private on = 0;
  private off = 0;
  private pending: [Epoch, Signals][] = [];
  private lastT: number | null = null;

  signals(e: Epoch): Signals {
    const S = SETTINGS, st = this.base.stats(), codes: EvidenceCode[] = [];
    let jam = 0, spoof = 0, cnoDrop = 0, agcShift = 0, jamRise = 0, offset = 0;
    if (st.cno && e.cnoTop !== null) {
      cnoDrop = st.cno.c - e.cnoTop;
      const lim = 4 * Math.max(st.cno.spread, 0.75);
      if (cnoDrop >= Math.max(S.cnoDropDb, lim)) { jam += 2; codes.push("cno_drop"); }
      else if (-cnoDrop >= Math.max(S.cnoRiseDb, lim)) { spoof += 1; codes.push("cno_rise"); }
    }
    if (st.cno && e.cnoTop === null && e.satsTracked === 0) { jam += 2; codes.push("no_sats"); }
    if (st.agc && e.agc !== null && st.agc.c > 0) {
      agcShift = Math.abs(e.agc - st.agc.c) / st.agc.c;
      if (agcShift >= Math.max(S.agcShift, (5 * st.agc.spread) / st.agc.c)) { jam += 1; codes.push("agc"); }
    }
    if (st.jam && e.jamInd !== null) {
      jamRise = e.jamInd - st.jam.c;
      if (jamRise >= Math.max(S.jamIndRise, 5 * Math.max(st.jam.spread, 1))) { jam += 1; codes.push("jam_ind"); }
    }
    if (e.jamState >= 2) { jam += 2; codes.push("rx_jam"); }
    if (this.base.ready && e.fix < 2 && jam >= 1) { jam += 1; codes.push("fix_lost"); }
    if (e.spoofState >= 2) { spoof += 2; codes.push("rx_spoof"); }
    if (this.base.refLat !== null && this.base.refLon !== null && e.lat !== null && e.lon !== null && e.fix >= 3 && e.hAccM !== null && e.hAccM <= S.goodHaccM) {
      offset = haversineM(this.base.refLat, this.base.refLon, e.lat, e.lon);
      if (offset >= Math.max(S.offsetStrongM, 10 * e.hAccM)) { spoof += 3; codes.push("offset"); }
      else if (offset >= Math.max(S.offsetM, 5 * e.hAccM)) { spoof += 2; codes.push("offset"); }
    }
    return { jam, spoof, codes, cnoDrop, agcShift, jamRise, offset };
  }

  feed(e: Epoch): SiteEvent[] {
    const done: SiteEvent[] = [];
    if (this.lastT !== null && e.t - this.lastT > SETTINGS.gapS) {
      done.push(...this.close(true));
      this.pending = []; this.on = 0;
    }
    this.lastT = e.t;
    const sig = this.signals(e);
    const kind = sig.spoof >= 3 ? "spoofing" : sig.jam >= 3 ? "jamming" : null;
    if (!this.open) {
      if (kind) {
        this.on++;
        this.pending.push([e, sig]);
        if (this.on >= SETTINGS.minOnS) {
          const first = this.pending[0]![0];
          this.open = { kind, start: first.t, end: e.t, confidence: "Low", evidence: [], peakCnoDropDb: 0, peakCnoRiseDb: 0, peakAgcShift: 0, peakJamIndRise: 0, maxOffsetM: 0, closedByGap: false };
          for (const [pe, ps] of this.pending) this.absorb(pe, ps);
          this.pending = []; this.off = 0;
        }
      } else {
        for (const [pe] of this.pending) this.base.addClean(pe);
        this.pending = []; this.on = 0;
        this.base.addClean(e);
      }
    } else if (kind) {
      this.off = 0;
      if (kind === "spoofing" && this.open.kind === "jamming") this.open.kind = "spoofing";
      this.absorb(e, sig);
    } else if (++this.off >= SETTINGS.minOffS) {
      done.push(...this.close(false));
    }
    return done;
  }

  flush() { return this.close(false); }

  private absorb(e: Epoch, s: Signals) {
    const ev = this.open!;
    ev.end = e.t;
    ev.peakCnoDropDb = Math.max(ev.peakCnoDropDb, s.cnoDrop);
    if (s.cnoDrop < 0) ev.peakCnoRiseDb = Math.max(ev.peakCnoRiseDb, -s.cnoDrop);
    ev.peakAgcShift = Math.max(ev.peakAgcShift, s.agcShift);
    ev.peakJamIndRise = Math.max(ev.peakJamIndRise, s.jamRise);
    ev.maxOffsetM = Math.max(ev.maxOffsetM, s.offset);
    for (const c of s.codes) if (!ev.evidence.includes(c)) ev.evidence.push(c);
  }

  private close(gap: boolean): SiteEvent[] {
    const ev = this.open;
    this.open = null; this.off = 0; this.on = 0;
    if (!ev) return [];
    ev.closedByGap = gap;
    const c = new Set(ev.evidence);
    const g = {
      signal: c.has("cno_drop") || c.has("no_sats"), gain: c.has("agc"), indicator: c.has("jam_ind"),
      receiver: c.has("rx_jam") || c.has("rx_spoof"), position: c.has("offset"), stronger: c.has("cno_rise"),
    };
    const n = Object.values(g).filter(Boolean).length;
    ev.confidence = n >= 3 || (n >= 2 && g.receiver) ? "High" : n >= 2 ? "Medium" : "Low";
    return [ev];
  }
}

export function detect(epochs: Epoch[]): SiteEvent[] {
  const d = new Detector();
  const out: SiteEvent[] = [];
  for (const e of epochs) out.push(...d.feed(e));
  out.push(...d.flush());
  return out;
}

export function describe(ev: SiteEvent): string[] {
  const f = (n: number, dp = 1) => n.toFixed(dp);
  const text: Record<EvidenceCode, string> = {
    cno_drop: `Every strong satellite got weaker at once (peak ${f(ev.peakCnoDropDb)} dB below normal)`,
    no_sats: "No satellites could be received",
    agc: `Front-end gain moved away from normal (peak ${Math.round(ev.peakAgcShift * 100)}%)`,
    jam_ind: `Receiver's jamming indicator rose (peak +${Math.round(ev.peakJamIndRise)})`,
    rx_jam: "Receiver raised its own jamming flag",
    fix_lost: "Position fix was lost",
    rx_spoof: "Receiver raised its own spoofing flag",
    offset: `Fixed antenna appeared to move (up to ${Math.round(ev.maxOffsetM)} m)`,
    cno_rise: `Signals were stronger than normal (peak ${f(ev.peakCnoRiseDb)} dB)`,
  };
  return ev.evidence.map((c) => text[c]);
}

/** Parses a sensor log CSV (see SENSOR_COLUMNS). Only time and cno_top are required. */
export function parseSensorCsv(text: string): { epochs: Epoch[] } | { error: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return { error: "The file needs a header row and at least two readings." };
  const head = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const missing = REQUIRED_COLS.filter((c) => !head.includes(c));
  if (missing.length) return { error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${SENSOR_COLUMNS.join(", ")}.` };
  if (lines.length - 1 > 50000) return { error: "Up to 50,000 readings (about 14 hours at one per second), please." };
  const idx = Object.fromEntries(SENSOR_COLUMNS.map((c) => [c, head.indexOf(c)])) as Record<(typeof SENSOR_COLUMNS)[number], number>;
  const epochs: Epoch[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r]!.split(",");
    const raw = (c: (typeof SENSOR_COLUMNS)[number]) => (idx[c] >= 0 ? (cells[idx[c]] ?? "").trim() : "");
    const num = (c: (typeof SENSOR_COLUMNS)[number]) => { const v = raw(c); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
    const t = Date.parse(raw("time"));
    if (Number.isNaN(t)) return { error: `Row ${r + 1}: "time" must be an ISO timestamp (e.g. 2026-10-01T14:00:00Z).` };
    const e: Epoch = {
      t: t / 1000, fix: num("fix") ?? 3, numSv: num("num_sv") ?? 0, hAccM: num("h_acc_m"), cnoTop: num("cno_top"),
      satsTracked: num("sats_tracked") ?? (num("cno_top") === null ? 0 : 10), agc: num("agc"), jamInd: num("jam_ind"),
      jamState: num("jam_state") ?? 0, spoofState: num("spoof_state") ?? 0, lat: num("lat"), lon: num("lon"),
    };
    for (const [k, v] of Object.entries(e)) if (typeof v === "number" && Number.isNaN(v)) return { error: `Row ${r + 1}: "${k}" is not a number.` };
    if (e.lat !== null && Math.abs(e.lat) > 90) return { error: `Row ${r + 1}: lat out of range.` };
    if (e.lon !== null && Math.abs(e.lon) > 180) return { error: `Row ${r + 1}: lon out of range.` };
    epochs.push(e);
  }
  epochs.sort((a, b) => a.t - b.t);
  return { epochs };
}

/** One point per minute for charting: median signal strength and gain. */
export function minuteSeries(epochs: Epoch[]) {
  const by = new Map<number, Epoch[]>();
  for (const e of epochs) { const m = Math.floor(e.t / 60) * 60; (by.get(m) ?? by.set(m, []).get(m)!).push(e); }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, es]) => {
    const cno = es.map((e) => e.cnoTop).filter((x): x is number => x !== null);
    const agc = es.map((e) => e.agc).filter((x): x is number => x !== null);
    return { t, cno: cno.length ? Math.round(median(cno) * 10) / 10 : null, agc: agc.length ? Math.round(median(agc)) : null };
  });
}
