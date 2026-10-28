/**
 * Witnessmark incident evidence engine — Evidence method v0.4.
 * Two independent witnesses: the drone's own GPS receiver (E-checks) and aircraft
 * overhead (S-checks). A 2x2 table turns them into a finding with a confidence level.
 * Pure functions only, so the same code runs in the browser, on the server and in tests.
 */

export type Point = {
  t: string; lat: number; lon: number;
  accuracy_m: number | null; satellites: number | null;
  jamming_state: number | null; spoofing_state: number | null;
};
export type SkyEvent = { type: string; lat: number; lon: number; start_time: string; end_time: string };
export type SkyHex = { hour: string; lat: number; lon: number; low_quality_count: number; total_count: number };

export const THRESHOLDS = {
  e2AccuracyBefore: 3, // m
  e2AccuracyAfter: 10, // m
  e2WindowS: 10,
  e2SatDrop: 5,
  e3SpeedMs: 30,
  skyMinAircraft: 5,
  skyDegradedShare: 0.2,
  skyEventRadiusKm: 50,
  skyHexMaxKm: 60,
  minPoints: 10,
} as const;

export function distM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type CheckResult = "met" | "not_met" | "na";
export type Rule = {
  id: string; label: string; source: "drone" | "aircraft";
  result: CheckResult; fired: boolean; index: number | null;
  observed: string; threshold: string; detail: string;
};

export function droneEvidence(pts: Point[]) {
  const T = THRESHOLDS;
  const ms = pts.map((p) => new Date(p.t).getTime());
  const flagsKnown = pts.some((p) => p.jamming_state !== null || p.spoofing_state !== null);
  const accKnown = pts.some((p) => p.accuracy_m !== null);
  const satKnown = pts.some((p) => p.satellites !== null);
  let e1: number | null = null, e2: number | null = null, e3: number | null = null;
  let e3Speed = 0, maxSpeed = 0, worstAcc = 0, minSat = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (p.accuracy_m !== null) worstAcc = Math.max(worstAcc, p.accuracy_m);
    if (p.satellites !== null) minSat = Math.min(minSat, p.satellites);
    if (e1 === null && (p.jamming_state === 3 || p.spoofing_state === 3)) e1 = i;
    if (e2 === null && p.accuracy_m !== null && p.accuracy_m < T.e2AccuracyBefore && p.satellites !== null) {
      for (let j = i + 1; j < pts.length && ms[j]! - ms[i]! <= T.e2WindowS * 1000; j++) {
        const q = pts[j]!;
        if (q.accuracy_m !== null && q.accuracy_m > T.e2AccuracyAfter && q.satellites !== null && p.satellites - q.satellites >= T.e2SatDrop) { e2 = j; break; }
      }
    }
    if (i > 0) {
      const dt = (ms[i]! - ms[i - 1]!) / 1000;
      const v = dt > 0 ? distM(pts[i - 1]!.lat, pts[i - 1]!.lon, p.lat, p.lon) / dt : 0;
      maxSpeed = Math.max(maxSpeed, v);
      if (e3 === null && v > T.e3SpeedMs) { e3 = i; e3Speed = v; }
    }
  }
  const e2Avail = accKnown && satKnown;
  const rules: Rule[] = [
    {
      id: "E1", source: "drone", label: "Receiver reported jamming or spoofing",
      result: e1 !== null ? "met" : flagsKnown ? "not_met" : "na", fired: e1 !== null, index: e1,
      observed: !flagsKnown ? "No receiver alarm fields in log" : e1 !== null ? "State 3 (detected)" : "Never reached state 3",
      threshold: "jamming_state or spoofing_state = 3",
      detail: e1 !== null ? "The drone's own GPS chip flagged interference." : flagsKnown ? "The receiver never flagged interference." : "Not assessable: this log has no jamming/spoofing columns, so E2 and E3 carry the drone evidence.",
    },
    {
      id: "E2", source: "drone", label: "Sudden accuracy collapse with satellite loss",
      result: e2 !== null ? "met" : e2Avail ? "not_met" : "na", fired: e2 !== null, index: e2,
      observed: !e2Avail ? "Accuracy or satellite data missing" : e2 !== null ? `${pts[e2]!.accuracy_m?.toFixed(1)} m, ${pts[e2]!.satellites} satellites` : `Worst ${worstAcc.toFixed(1)} m, min ${Number.isFinite(minSat) ? minSat : "–"} satellites`,
      threshold: `< ${T.e2AccuracyBefore} m → > ${T.e2AccuracyAfter} m within ${T.e2WindowS} s, satellites −${T.e2SatDrop}`,
      detail: e2 !== null ? "Position accuracy collapsed while satellites dropped out — the typical signature of jamming." : e2Avail ? "No sudden signal collapse." : "Not assessable without accuracy and satellite columns.",
    },
    {
      id: "E3", source: "drone", label: "Physically impossible position jump",
      result: pts.length < 2 ? "na" : e3 !== null ? "met" : "not_met", fired: e3 !== null, index: e3,
      observed: e3 !== null ? `${e3Speed.toFixed(0)} m/s jump` : `Max ${maxSpeed.toFixed(1)} m/s`,
      threshold: `Implied speed > ${T.e3SpeedMs} m/s`,
      detail: e3 !== null ? "Two consecutive fixes imply an impossible speed — a possible spoofing sign." : "No impossible position jumps.",
    },
  ];
  const fired = rules.filter((r) => r.index !== null).map((r) => r.index!);
  const assessable = rules.some((r) => r.result !== "na");
  return { rules, yes: fired.length > 0, firstIndex: fired.length ? Math.min(...fired) : null, flagsKnown, accKnown, satKnown, assessable };
}

export type SkyResult = {
  status: "yes" | "no" | "unknown";
  planes: number; degraded: number | null; hexDistanceKm: number | null; events: SkyEvent[];
  reasons: string[]; rules: Rule[];
};

export function skyEvidence(pts: Point[], events: SkyEvent[], hexes: SkyHex[]): SkyResult {
  const T = THRESHOLDS;
  const start = new Date(pts[0]!.t).getTime(), end = new Date(pts[pts.length - 1]!.t).getTime();
  const c = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length };
  const near = events.filter((e) =>
    new Date(e.start_time).getTime() <= end && new Date(e.end_time).getTime() >= start &&
    pts.some((p) => distM(p.lat, p.lon, e.lat, e.lon) <= T.skyEventRadiusKm * 1000));
  const hourStart = Math.floor(start / 3600000) * 3600000;
  const candidates = hexes
    .filter((h) => new Date(h.hour).getTime() === hourStart)
    .map((h) => ({ h, d: distM(c.lat, c.lon, h.lat, h.lon) }))
    .filter((x) => x.d <= T.skyHexMaxKm * 1000)
    .sort((a, b) => a.d - b.d);
  const hex = candidates[0]?.h;
  const hexDistanceKm = candidates[0] ? candidates[0].d / 1000 : null;
  const planes = hex?.total_count ?? 0;
  const degraded = hex && hex.total_count > 0 ? hex.low_quality_count / hex.total_count : null;
  const enoughPlanes = planes >= T.skyMinAircraft;
  const shareHigh = enoughPlanes && (degraded ?? 0) > T.skyDegradedShare;

  const reasons: string[] = [];
  if (near.length) reasons.push(`A reported ${near[0]!.type} event within ${T.skyEventRadiusKm} km overlaps the flight.`);
  if (shareHigh) reasons.push(`${Math.round((degraded ?? 0) * 100)}% of aircraft overhead reported degraded GPS (threshold ${T.skyDegradedShare * 100}%).`);
  let status: SkyResult["status"];
  if (near.length || shareHigh) status = "yes";
  else if (!enoughPlanes) { status = "unknown"; reasons.push(hex ? `Only ${planes} aircraft overhead that hour (need ${T.skyMinAircraft} or more).` : `No aircraft data within ${T.skyHexMaxKm} km for that hour.`); }
  else { status = "no"; reasons.push(`${planes} aircraft overhead; no overlapping events; degraded share ${Math.round((degraded ?? 0) * 100)}% (≤ ${T.skyDegradedShare * 100}%).`); }

  const rules: Rule[] = [
    {
      id: "S1", source: "aircraft", label: "Reported interference event overlaps the flight",
      result: near.length ? "met" : "not_met", fired: near.length > 0, index: null,
      observed: near.length ? `${near.length} event${near.length > 1 ? "s" : ""}` : "None",
      threshold: `Event within ${T.skyEventRadiusKm} km, overlapping in time`,
      detail: near.length ? "An aircraft-derived jamming or spoofing event covers this place and time." : "No reported events near this flight.",
    },
    {
      id: "S2", source: "aircraft", label: "High share of aircraft with degraded GPS",
      result: !enoughPlanes ? "na" : shareHigh ? "met" : "not_met", fired: shareHigh, index: null,
      observed: hex ? `${planes} aircraft, ${degraded === null ? "–" : Math.round(degraded * 100) + "%"} degraded` : "No aircraft data",
      threshold: `≥ ${T.skyMinAircraft} aircraft and > ${T.skyDegradedShare * 100}% degraded`,
      detail: !enoughPlanes ? "Not assessable: too few aircraft overhead to judge the wider sky." : shareHigh ? "Aircraft overhead were affected too." : "Aircraft overhead were not unusually affected.",
    },
  ];
  return { status, planes, degraded, hexDistanceKm, events: near, reasons, rules };
}

export type Confidence = "High" | "Medium" | "Low";

export const VERDICTS = {
  "yes-yes": { title: "Consistent with external GPS interference", confidence: "High" as Confidence },
  "yes-no": { title: "Consistent with local GPS interference (source too low for aircraft to detect)", confidence: "Medium" as Confidence },
  "no-yes": { title: "Area affected, drone was not. GPS interference unlikely to be the cause", confidence: "Medium" as Confidence },
  "no-no": { title: "No evidence of interference. Check pilot input and hardware", confidence: "High" as Confidence },
} as const;
export type VerdictKey = keyof typeof VERDICTS;

export type Verdict = {
  key: VerdictKey | null; row: "yes" | "no"; title: string; confidence: Confidence;
  skyLabel: string; why: string; lean: "interference" | "clean" | "inconclusive";
};

export function verdict(drone: boolean, sky: SkyResult["status"], dataPoor = false): Verdict {
  const d = drone ? "yes" : "no";
  let v: Verdict;
  if (sky === "unknown") {
    v = {
      key: null, row: d,
      title: drone ? "Drone shows GPS interference; source unconfirmed" : "No evidence of interference in the drone log. Check pilot input and hardware",
      confidence: "Medium", skyLabel: "Not enough aircraft data",
      why: "Only the drone's own log could be assessed, so confidence is capped at Medium.",
      lean: drone ? "interference" : "clean",
    };
  } else {
    const key = `${d}-${sky}` as VerdictKey;
    const base = VERDICTS[key];
    v = {
      key, row: d, title: base.title, confidence: base.confidence, skyLabel: sky === "yes" ? "Yes" : "No",
      why: base.confidence === "High" ? "Both independent witnesses were available and agree." : "The witnesses disagree in a way the method explains.",
      lean: key === "yes-yes" || key === "yes-no" ? "interference" : key === "no-no" ? "clean" : "inconclusive",
    };
  }
  if (dataPoor) {
    v = { ...v, confidence: "Low", why: "The drone log is too sparse or lacks GPS quality fields, so this finding is not reliable on its own." };
  }
  return v;
}

export type Analysis = ReturnType<typeof analyse>;

export function analyse(pts: Point[], events: SkyEvent[], hexes: SkyHex[]) {
  const drone = droneEvidence(pts);
  const sky = skyEvidence(pts, events, hexes);
  const dataPoor = pts.length < THRESHOLDS.minPoints || (!drone.flagsKnown && !drone.accKnown && !drone.satKnown);
  const v = verdict(drone.yes, sky.status, dataPoor);
  const rules = [...drone.rules, ...sky.rules];
  const durationS = Math.round((new Date(pts[pts.length - 1]!.t).getTime() - new Date(pts[0]!.t).getTime()) / 1000);

  const change: string[] = [];
  if (sky.status === "unknown") change.push("Aircraft data for this hour and place would let the second witness confirm or rule out a wider interference area.");
  if (!drone.flagsKnown) change.push("A log that includes the receiver's jamming and spoofing fields (E1) would strengthen the drone evidence.");
  if (drone.yes && sky.status === "no") change.push("A ground sensor or second drone log from the same area could confirm a local, low-level source.");
  if (!drone.yes && sky.status !== "yes") change.push("Evidence of a control-link or hardware fault would point the claim elsewhere; this method only covers GPS.");
  if (drone.yes && sky.status === "yes") change.push("Evidence that the drone's receiver was faulty before the flight would weaken this finding.");
  if (dataPoor) change.push("A complete flight log (more points, with accuracy and satellite counts) is needed for a reliable finding.");

  const limits: string[] = [
    "Aircraft observe GPS quality at altitude; low-power jammers near the ground may not reach them.",
    "The fingerprint shows the file has not changed since upload. It does not show the log was accurate when it was recorded.",
  ];
  if (!drone.flagsKnown) limits.unshift("This log has no receiver alarm fields, so check E1 could not be assessed.");
  if (sky.status === "unknown") limits.unshift("Too little aircraft data for this hour and place; the finding rests on the drone log alone.");
  if (sky.hexDistanceKm !== null && sky.hexDistanceKm > 25) limits.push(`The nearest aircraft reading is ${sky.hexDistanceKm.toFixed(0)} km from the flight.`);
  limits.push("Thresholds are provisional and have not yet been validated on real claims.");

  return { drone, sky, v, rules, durationS, dataPoor, change, limits };
}
