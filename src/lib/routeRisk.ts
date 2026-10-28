/**
 * Witnessmark pre-flight check — Pre-flight method v0.2.
 * For each route section: P_loss = P_nav × V, judged against thresholds set by the
 * ground consequence class, with hard NO-GO gates on top and a confidence label.
 * Every weight below is a provisional starting value to be calibrated on real data.
 */
import { distM, type SkyEvent, type SkyHex } from "@/lib/evidence";

export type LatLon = [number, number];
export type Decision = "go" | "caution" | "nogo";
export type Confidence = "High" | "Medium" | "Low";
export type ConsequenceClass = "C1" | "C2" | "C3" | "C4";
export type AreaType = "central" | "urban" | "rural";

export const LONDON: LatLon = [51.5074, -0.1278];

export const PRIOR: Record<AreaType, number> = { central: 0.005, urban: 0.002, rural: 0.001 };
export const AREA_LABEL: Record<AreaType, string> = { central: "Dense city centre", urban: "Urban / suburban", rural: "Rural" };

export const THRESHOLDS: Record<ConsequenceClass, { go: number; nogo: number; label: string; density: string }> = {
  C1: { go: 0.05, nogo: 0.2, label: "Controlled ground area or very sparse", density: "< 50 people/km²" },
  C2: { go: 0.02, nogo: 0.1, label: "Sparsely populated", density: "50–500 people/km²" },
  C3: { go: 0.01, nogo: 0.05, label: "Populated", density: "500–5,000 people/km²" },
  C4: { go: 0.005, nogo: 0.02, label: "Densely populated or near gatherings", density: "> 5,000 people/km²" },
};

export const VULNERABILITY = {
  multiBand: { label: "Multi-band, multi-constellation GNSS receiver", factor: 0.7 },
  flagsAndFailsafe: { label: "Receiver jamming/spoofing flags read and GNSS-loss failsafe configured", factor: 0.7 },
  deadReckoning: { label: "Validated optical-flow / visual-inertial dead reckoning enabled", factor: 0.4 },
  vlosPilot: { label: "Within visual line of sight, pilot trained to fly without GNSS", factor: 0.5 },
  needsRtk: { label: "Mission needs RTK (centimetre) accuracy", factor: 1.5 },
  dualGnssSeparate: { label: "Dual GNSS on separate antennas", factor: 0.9 },
} as const;
export type VulnKey = keyof typeof VULNERABILITY;
export type DroneProfile = Record<VulnKey, boolean> & { timeToLandS: number | null; deadReckonLimitS: number | null };

export type Venue = { id: string; name: string; lat: number; lon: number; kind: string };
/** Public locations of major London venues. Event calendars are not connected yet. */
export const LONDON_VENUES: Venue[] = [
  { id: "wembley", name: "Wembley Stadium", lat: 51.556, lon: -0.2796, kind: "Stadium" },
  { id: "emirates", name: "Emirates Stadium", lat: 51.5549, lon: -0.1084, kind: "Stadium" },
  { id: "tottenham", name: "Tottenham Hotspur Stadium", lat: 51.6043, lon: -0.0664, kind: "Stadium" },
  { id: "stamford", name: "Stamford Bridge", lat: 51.4817, lon: -0.191, kind: "Stadium" },
  { id: "london-stadium", name: "London Stadium", lat: 51.5386, lon: -0.0166, kind: "Stadium" },
  { id: "twickenham", name: "Twickenham Stadium", lat: 51.456, lon: -0.3415, kind: "Stadium" },
  { id: "lords", name: "Lord's Cricket Ground", lat: 51.5299, lon: -0.1726, kind: "Stadium" },
  { id: "oval", name: "The Oval", lat: 51.4837, lon: -0.115, kind: "Stadium" },
  { id: "o2", name: "The O2", lat: 51.503, lon: 0.0032, kind: "Arena" },
  { id: "westminster", name: "Parliament Square / Westminster", lat: 51.5005, lon: -0.1268, kind: "State events & protests" },
  { id: "palace", name: "Buckingham Palace / The Mall", lat: 51.5014, lon: -0.1419, kind: "State events" },
  { id: "hydepark", name: "Hyde Park", lat: 51.5073, lon: -0.1657, kind: "Concerts & gatherings" },
];

export type Gates = { notamRed: boolean; restrictedNoPermission: boolean; weatherOutside: boolean };
export type SpaceWeather = "quiet" | "g3" | "g4";

export type RouteContext = {
  start: Date;
  durationMin: number;
  hexes: SkyHex[]; // aircraft readings in the lookback window
  events: SkyEvent[]; // reported events in the lookback window
  activeVenues: Venue[]; // venues the user says have an event during the flight window
  spaceWeather: SpaceWeather;
  denseHighRise: boolean;
  nearMajorRoads: boolean;
  gates: Gates;
  areaOverride: AreaType | "auto";
  consequenceOverride: ConsequenceClass | "auto";
  lookbackDays: number;
};

export type Driver = { label: string; factor: number };

export type SectionResult = {
  index: number; start: LatLon; end: LatLon; mid: LatLon; lengthKm: number;
  area: AreaType; areaSource: "London model" | "Your choice" | "Default";
  consequence: ConsequenceClass; consequenceSource: "London model" | "Your choice" | "Default";
  prior: number; adsb: { n: number; k: number; u90: number; newest: string | null };
  eventsNearby: number; pInt: number; pEnv: number; pNav: number; v: number; pLoss: number;
  decision: Decision; rawDecision: Decision; confidence: Confidence;
  drivers: Driver[]; gateReasons: string[]; notes: string[]; why: string;
};

export type RouteResult = {
  sections: SectionResult[]; decision: Decision; confidence: Confidence; pRoute: number;
  totalKm: number; worstIndex: number; bufferM: number; holdoverS: number; v: number;
  vFactors: Driver[]; conditions: string[]; dataAsOf: string | null; method: string; routeLevelNote: string | null;
};

// ---------- maths helpers ----------
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function lnGamma(z: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a: number, b: number, x: number) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function betaInc(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** q-quantile of Beta(a, b) by bisection. */
export function betaQuantile(q: number, a: number, b: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaInc(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- geometry ----------
export const kmBetween = (a: LatLon, b: LatLon) => distM(a[0], a[1], b[0], b[1]) / 1000;

/** Cut a route into sections of about `sectionKm` (last tiny leftover merges into the previous section). */
export function splitRoute(points: LatLon[], sectionKm: number): { start: LatLon; end: LatLon; lengthKm: number }[] {
  if (points.length < 2) return [];
  const dense: LatLon[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const steps = Math.max(1, Math.ceil(kmBetween(a, b) / (sectionKm / 10)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  const out: { start: LatLon; end: LatLon; lengthKm: number }[] = [];
  let start = dense[0]!, run = 0;
  for (let i = 1; i < dense.length; i++) {
    run += kmBetween(dense[i - 1]!, dense[i]!);
    if (run >= sectionKm - 1e-9) { out.push({ start, end: dense[i]!, lengthKm: run }); start = dense[i]!; run = 0; }
  }
  if (run > 0) {
    if (run > Math.max(0.05, sectionKm * 0.25) || !out.length) out.push({ start, end: dense[dense.length - 1]!, lengthKm: run });
    else { const last = out[out.length - 1]!; out[out.length - 1] = { start: last.start, end: dense[dense.length - 1]!, lengthKm: last.lengthKm + run }; }
  }
  return out;
}

// ---------- area & consequence models ----------
const LONDON_MODEL_KM = 40;

export function areaFor(mid: LatLon, override: AreaType | "auto"): { area: AreaType; source: SectionResult["areaSource"] } {
  if (override !== "auto") return { area: override, source: "Your choice" };
  const d = kmBetween(mid, LONDON);
  if (d <= LONDON_MODEL_KM) return { area: d < 5 ? "central" : d < 25 ? "urban" : "rural", source: "London model" };
  return { area: "urban", source: "Default" };
}

export function consequenceFor(mid: LatLon, override: ConsequenceClass | "auto"): { c: ConsequenceClass; source: SectionResult["consequenceSource"] } {
  if (override !== "auto") return { c: override, source: "Your choice" };
  const d = kmBetween(mid, LONDON);
  if (d <= LONDON_MODEL_KM) return { c: d < 3 ? "C4" : d < 15 ? "C3" : d < 30 ? "C2" : "C1", source: "London model" };
  return { c: "C3", source: "Default" };
}

export function decide(pLoss: number, c: ConsequenceClass): Decision {
  const t = THRESHOLDS[c];
  return pLoss >= t.nogo ? "nogo" : pLoss >= t.go ? "caution" : "go";
}

const RANK: Record<Decision, number> = { go: 0, caution: 1, nogo: 2 };
const worse = (a: Decision, b: Decision) => (RANK[a] >= RANK[b] ? a : b);

export function vulnerability(p: DroneProfile): { v: number; factors: Driver[] } {
  let v = 1;
  const factors: Driver[] = [];
  for (const k of Object.keys(VULNERABILITY) as VulnKey[]) {
    if (p[k]) { v *= VULNERABILITY[k].factor; factors.push({ label: VULNERABILITY[k].label, factor: VULNERABILITY[k].factor }); }
  }
  if (p.timeToLandS != null && p.deadReckonLimitS != null && p.timeToLandS > p.deadReckonLimitS) {
    v *= 1.5;
    factors.push({ label: `Holdover check fails: ${p.timeToLandS} s to land vs ${p.deadReckonLimitS} s dead-reckoning limit`, factor: 1.5 });
  }
  return { v: Math.min(1, Math.max(0.05, v)), factors };
}

const pct = (p: number) => (p < 0.001 ? "<0.1%" : p > 0.995 ? ">99%" : `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`);
export { pct };

export function assessSection(mid: LatLon, ctx: RouteContext, v: number) {
  const startMs = ctx.start.getTime();
  const since = startMs - ctx.lookbackDays * 86400000;
  const drivers: Driver[] = [];
  const notes: string[] = [];

  const { area, source: areaSource } = areaFor(mid, ctx.areaOverride);
  const { c: consequence, source: consequenceSource } = consequenceFor(mid, ctx.consequenceOverride);
  const prior = PRIOR[area];
  let lo = logit(prior);
  const add = (label: string, factor: number) => { lo += Math.log(factor); drivers.push({ label, factor }); };

  // Aircraft (ADS-B) — Beta posterior, judged on the 90% upper bound.
  let n = 0, k = 0, newest: number | null = null;
  for (const h of ctx.hexes) {
    const t = new Date(h.hour).getTime();
    if (t < since || t > startMs) continue;
    if (distM(mid[0], mid[1], h.lat, h.lon) > 10000) continue;
    n += h.total_count; k += h.low_quality_count;
    newest = newest === null ? t : Math.max(newest, t);
  }
  const u90 = betaQuantile(0.9, 1 + k, 1 + n - k);
  const l10 = betaQuantile(0.1, 1 + k, 1 + n - k);
  // Sparse, clean data is not evidence of risk: it just lowers the confidence.
  if (n < 5 || (n < 20 && k === 0)) { /* no evidence either way */ }
  else if (n >= 20 && l10 >= 0.2) add(`Aircraft nearby: at least ${pct(l10)} with degraded GPS (strong evidence, ${n} reports)`, 200);
  else if (n >= 20 && l10 >= 0.05) add(`Aircraft nearby: at least ${pct(l10)} with degraded GPS (${n} reports)`, 30);
  else if (u90 >= 0.2) add(`Aircraft nearby: up to ${pct(u90)} with degraded GPS (90% bound, ${n} reports)`, 10);
  else if (u90 >= 0.05) add(`Aircraft nearby: up to ${pct(u90)} with degraded GPS (90% bound, ${n} reports)`, 3);
  else if (n >= 20) add(`Aircraft nearby: clean (${n} reports, ≤ ${pct(u90)} degraded)`, 0.8);
  if (n < 20) notes.push(`Only ${n} aircraft reports within 10 km in the last ${ctx.lookbackDays} days.`);

  // Reported interference events within 50 km.
  let ev24 = 0, ev7 = 0, eventsNearby = 0;
  for (const e of ctx.events) {
    if (distM(mid[0], mid[1], e.lat, e.lon) > 50000) continue;
    const s = new Date(e.start_time).getTime(), en = new Date(e.end_time).getTime();
    if (s > startMs + ctx.durationMin * 60000 || en < since) continue;
    eventsNearby++;
    const age = startMs - en;
    if (age <= 86400000) ev24++;
    else if (age <= 7 * 86400000) ev7++;
  }
  if (ev24) add(`Reported jamming/spoofing event within 50 km in the last 24 h`, 5);
  else if (ev7) add(`Reported jamming/spoofing event within 50 km in the last 7 days`, 2);

  // Major venues with an event during the flight window.
  let bestVenue: { f: number; label: string } | null = null;
  for (const venue of ctx.activeVenues) {
    const d = distM(mid[0], mid[1], venue.lat, venue.lon) / 1000;
    const f = d <= 2 ? 5 : d <= 5 ? 2 : 1;
    if (f > 1 && (!bestVenue || f > bestVenue.f)) bestVenue = { f, label: `Event at ${venue.name}, ${d.toFixed(1)} km away` };
  }
  if (bestVenue) add(bestVenue.label, bestVenue.f);
  if (ctx.nearMajorRoads) add("Route near major roads (in-car jammers)", 1.5);

  const pInt = sigmoid(lo);
  const pSpace = ctx.spaceWeather === "g4" ? 0.1 : ctx.spaceWeather === "g3" ? 0.02 : 0;
  const pCanyon = ctx.denseHighRise ? 0.05 : 0;
  if (pSpace) drivers.push({ label: `Geomagnetic storm forecast (${ctx.spaceWeather.toUpperCase()}+)`, factor: 1 + pSpace * 10 });
  if (pCanyon) drivers.push({ label: "Dense high-rise: poor satellite geometry / multipath", factor: 1.5 });
  const pEnv = 1 - (1 - pSpace) * (1 - pCanyon);
  const pNav = 1 - (1 - pInt) * (1 - pEnv);
  const pLoss = pNav * v;

  // Confidence: no Witnessmark ground sensors yet, so High is not reachable.
  const fresh = newest !== null && startMs - newest <= 7 * 86400000;
  const confidence: Confidence = n >= 20 && fresh ? "Medium" : "Low";
  if (n >= 20 && !fresh) notes.push("Aircraft data is more than 7 days older than the planned flight.");
  notes.push("No Witnessmark ground sensor within 1 km (network not yet deployed).");

  const rawDecision = decide(pLoss, consequence);
  let decision = rawDecision;
  const gateReasons: string[] = [];
  if (ctx.gates.notamRed) gateReasons.push("Inside a notified GNSS-interference area (NOTAM / red AIC area).");
  if (ctx.gates.restrictedNoPermission) gateReasons.push("Restricted airspace or FRZ without permission.");
  if (ctx.gates.weatherOutside) gateReasons.push("Weather outside the drone's limits.");
  if (gateReasons.length) decision = "nogo";
  else if (decision === "go" && confidence === "Low" && (consequence === "C3" || consequence === "C4")) {
    decision = "caution";
    notes.unshift("Data-limited: in populated areas, Low confidence can never produce GO.");
  }

  drivers.sort((a, b) => Math.abs(Math.log(b.factor)) - Math.abs(Math.log(a.factor)));
  const t = THRESHOLDS[consequence];
  const why = gateReasons.length
    ? `Hard stop: ${gateReasons.join(" ")}`
    : `Chance of losing trustworthy navigation ≈ ${pct(pLoss)} (interference ${pct(pNav)} × drone vulnerability ${v.toFixed(2)}). For ${consequence} ground (${t.density}) GO is below ${pct(t.go)} and NO-GO from ${pct(t.nogo)}.`;

  return {
    area, areaSource, consequence, consequenceSource, prior,
    adsb: { n, k, u90, newest: newest === null ? null : new Date(newest).toISOString() },
    eventsNearby, pInt, pEnv, pNav, v, pLoss, decision, rawDecision, confidence, drivers, gateReasons, notes, why,
  };
}

export function assessRoute(points: LatLon[], sectionKm: number, ctx: RouteContext, profile: DroneProfile): RouteResult | null {
  const parts = splitRoute(points, sectionKm);
  if (!parts.length) return null;
  const { v, factors } = vulnerability(profile);
  const sections: SectionResult[] = parts.map((p, index) => {
    const mid: LatLon = [(p.start[0] + p.end[0]) / 2, (p.start[1] + p.end[1]) / 2];
    return { index, start: p.start, end: p.end, mid, lengthKm: p.lengthKm, ...assessSection(mid, ctx, v) };
  });
  let decision: Decision = "go";
  let worstIndex = 0;
  sections.forEach((s, i) => { if (RANK[s.decision] > RANK[decision]) { decision = s.decision; worstIndex = i; } });
  const pRoute = 1 - sections.reduce((acc, s) => acc * (1 - s.pLoss), 1);
  const worstClass = sections.reduce<ConsequenceClass>((w, s) => (s.consequence > w ? s.consequence : w), "C1");
  const routeDecision = decide(pRoute, worstClass);
  let routeLevelNote: string | null = null;
  if (RANK[routeDecision] > RANK[decision]) {
    routeLevelNote = `Each section is below its own threshold, but over the whole route the combined chance (${pct(pRoute)}) passes the ${routeDecision === "nogo" ? "NO-GO" : "GO"} threshold for ${worstClass} ground (${pct(routeDecision === "nogo" ? THRESHOLDS[worstClass].nogo : THRESHOLDS[worstClass].go)}).`;
    decision = routeDecision;
  }
  const confidence: Confidence = sections.some((s) => s.confidence === "Low") ? "Low" : sections.some((s) => s.confidence === "Medium") ? "Medium" : "High";
  const holdoverS = profile.deadReckonLimitS ?? 10;
  const bufferM = Math.round(2 * holdoverS);
  const newestTimes = sections.map((s) => s.adsb.newest).filter(Boolean) as string[];
  const dataAsOf = newestTimes.length ? newestTimes.sort().at(-1)! : null;

  const conditions: string[] = [];
  if (decision !== "go") {
    if (!profile.vlosPilot) conditions.push("Keep the drone within visual line of sight with a pilot ready to fly without GNSS.");
    if (!profile.deadReckoning) conditions.push("Enable a validated non-GNSS fallback (optical flow or visual-inertial odometry) if fitted.");
    if (!profile.flagsAndFailsafe) conditions.push("Configure the GNSS-loss failsafe and monitor the receiver's jamming/spoofing flags.");
    if (profile.needsRtk) conditions.push("Do not rely on RTK accuracy on this route.");
    if (ctx.activeVenues.length) conditions.push("Avoid the event window (2 h before to 2 h after) or re-route away from the venue.");
    conditions.push(`Add about ${bufferM} m to your ground-risk buffer for drift during GNSS loss.`);
  }
  return { sections, decision, confidence, pRoute, totalKm: sections.reduce((a, s) => a + s.lengthKm, 0), worstIndex, bufferM, holdoverS, v, vFactors: factors, conditions, dataAsOf, method: "Pre-flight method v0.2", routeLevelNote };
}

export const DEFAULT_PROFILE: DroneProfile = {
  multiBand: false, flagsAndFailsafe: false, deadReckoning: false, vlosPilot: false, needsRtk: false, dualGnssSeparate: false,
  timeToLandS: null, deadReckonLimitS: null,
};
