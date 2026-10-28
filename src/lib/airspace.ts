/**
 * UK airspace check for the pre-flight decision (method v0.3).
 *
 * Aerodrome flight restriction zones (FRZs) follow the Air Navigation Order 2016, articles 94A and 94B:
 *  - the aerodrome traffic zone (ATZ): 2 NM radius (2.5 NM where the longest runway is over 1,850 m), centred on the
 *    mid-point of the longest runway, surface to 2,000 ft;
 *  - a runway protection zone (RPZ) at every runway threshold: 5 km long along the extended centre line, 1 km wide
 *    (1.5 km at Heathrow);
 *  - boundary zones out to 1 km beyond the aerodrome boundary (approximated as 1 km around each runway);
 *  - aerodromes without an ATZ or runway data: a 2 NM circle.
 * Shapes are built from public runway coordinates, so they are close to, but not exactly, the official NATS shapes.
 * Drones in the open and specific categories fly below 2,000 ft, so any route inside a zone is inside the FRZ.
 */
import { OTHER_AIRFIELDS, PROTECTED_AERODROMES, type Aerodrome } from "./airspaceData";

export type LatLon = [number, number];
const NM = 1.852;
const RPZ_LEN_KM = 5;
const BOUNDARY_KM = 1;
const AIRFIELD_KM = 2 * NM;
export const OPEN_CATEGORY_MAX_M = 120;

export type ZonePart =
  | { kind: "atz"; c: LatLon; rKm: number }
  | { kind: "rpz"; thr: LatLon; dir: LatLon /* unit vector in km-space, pointing away from the runway */; wKm: number; label: string }
  | { kind: "boundary"; a: LatLon; b: LatLon };

export type Hit = {
  id: string;
  name: string;
  /** frz = protected aerodrome (permission needed); airfield = other airfield (check with the operator). */
  level: "frz" | "airfield";
  kindLabel: string;
  parts: string[];
  permission: string;
};

// ---- local flat projection (km), accurate to well under 1% over a few km ----
const KX = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);
const KY = 110.574;
function toKm(p: LatLon, o: LatLon): [number, number] {
  return [(p[1] - o[1]) * KX(o[0]), (p[0] - o[0]) * KY];
}
function fromKm(x: number, y: number, o: LatLon): LatLon {
  return [o[0] + y / KY, o[1] + x / KX(o[0])];
}
function distToSegKm(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const KIND_LABEL: Record<Aerodrome["kind"], string> = {
  certificated: "Protected aerodrome (CAA certificated)",
  licensed: "Protected aerodrome (CAA licensed)",
  government: "Protected aerodrome (military)",
};

export function permissionText(a: Pick<Aerodrome, "id" | "name" | "kind">): string {
  if (a.id === "EGLL") return "Apply for an Off Airfield Drone Permit through the NATS portal (nsf.nats.aero) at least 14 days before the flight.";
  if (a.kind === "government") return `Ask ${a.name} air traffic control (Ministry of Defence) for permission before the flight.`;
  return `Ask ${a.name} air traffic control for permission (or the aerodrome operator if ATC is closed). Contact details are in the UK AIP; many airports take requests through the NATS portal (nsf.nats.aero).`;
}

/** The parts that make up one aerodrome's FRZ. */
export function frzParts(a: Aerodrome): ZonePart[] {
  const parts: ZonePart[] = [{ kind: "atz", c: a.c, rKm: a.atzNm * NM }];
  for (const [la1, lo1, la2, lo2, id1, id2] of a.runways) {
    const t1: LatLon = [la1, lo1], t2: LatLon = [la2, lo2];
    const [x, y] = toKm(t2, t1);
    const L = Math.hypot(x, y) || 1;
    // Each threshold's RPZ points outward, away from the other end of the runway.
    parts.push({ kind: "rpz", thr: t1, dir: [-x / L, -y / L], wKm: a.rpzW, label: id1 });
    parts.push({ kind: "rpz", thr: t2, dir: [x / L, y / L], wKm: a.rpzW, label: id2 });
    parts.push({ kind: "boundary", a: t1, b: t2 });
  }
  return parts;
}

function inPart(p: LatLon, z: ZonePart): boolean {
  if (z.kind === "atz") { const [x, y] = toKm(p, z.c); return Math.hypot(x, y) <= z.rKm; }
  if (z.kind === "rpz") {
    const [x, y] = toKm(p, z.thr);
    const u = x * z.dir[0] + y * z.dir[1];
    const v = -x * z.dir[1] + y * z.dir[0];
    return u >= 0 && u <= RPZ_LEN_KM && Math.abs(v) <= z.wKm / 2;
  }
  const o = z.a;
  return distToSegKm(toKm(p, o), [0, 0], toKm(z.b, o)) <= BOUNDARY_KM;
}

const partName = (z: ZonePart) => (z.kind === "atz" ? "traffic zone" : z.kind === "rpz" ? `runway ${z.label} protection zone` : "boundary zone");

/** Points every ~`stepKm` along a segment, ends included. */
export function samplesAlong(a: LatLon, b: LatLon, stepKm = 0.05): LatLon[] {
  const [x, y] = toKm(b, a);
  const n = Math.max(1, Math.ceil(Math.hypot(x, y) / stepKm));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as LatLon);
}

const roughKm = (p: LatLon, q: LatLon) => Math.hypot(...toKm(p, q));

/** Every protected aerodrome FRZ and other airfield that a straight segment enters. */
export function airspaceHits(a: LatLon, b: LatLon): Hit[] {
  const pts = samplesAlong(a, b);
  const segLen = roughKm(a, b);
  const hits: Hit[] = [];
  for (const ad of PROTECTED_AERODROMES) {
    // Quick reject: nothing in an FRZ is more than ~8 km from the ATZ centre plus the runway length.
    if (roughKm(a, ad.c) > segLen + 14) continue;
    const parts = frzParts(ad);
    const inside = new Set<string>();
    for (const z of parts) if (pts.some((p) => inPart(p, z))) inside.add(partName(z));
    if (inside.size) hits.push({ id: ad.id, name: ad.name, level: "frz", kindLabel: KIND_LABEL[ad.kind], parts: [...inside], permission: permissionText(ad) });
  }
  for (const [id, name, lat, lon] of OTHER_AIRFIELDS) {
    const c: LatLon = [lat, lon];
    if (roughKm(a, c) > segLen + AIRFIELD_KM + 1) continue;
    if (pts.some((p) => roughKm(p, c) <= AIRFIELD_KM)) {
      hits.push({ id, name, level: "airfield", kindLabel: "Airfield (not on the CAA protected lists)", parts: [`within ${(AIRFIELD_KM).toFixed(1)} km`],
        permission: `Check with ${name} before flying: it may still have a restriction zone, and aircraft fly low near any airfield.` });
    }
  }
  return hits;
}

// ---- central London restricted areas: we don't hold their exact boundaries yet, so we only flag the area ----
const CENTRAL_LONDON: LatLon = [51.5074, -0.1278];
export const CENTRAL_LONDON_KM = 9;
export const LONDON_RA_NOTE =
  "Central London has restricted areas EG R157 (Hyde Park), R158 (City of London) and R159 (Isle of Dogs). Any drone needs NATS approval to fly in them (CAP 722). Their exact boundaries aren't loaded here yet: check the NATS drone map.";
export const nearCentralLondon = (a: LatLon, b: LatLon) => samplesAlong(a, b, 0.25).some((p) => roughKm(p, CENTRAL_LONDON) <= CENTRAL_LONDON_KM);

// ---- map drawing ----
export type ZoneShape = { id: string; name: string; level: "frz" | "airfield"; kind: "circle" | "polygon"; c?: LatLon; rM?: number; poly?: LatLon[] };

export function zoneShapes(bounds: { s: number; w: number; n: number; e: number }): ZoneShape[] {
  const pad = 0.12; // about 13 km
  const inView = (p: LatLon) => p[0] >= bounds.s - pad && p[0] <= bounds.n + pad && p[1] >= bounds.w - pad * 1.6 && p[1] <= bounds.e + pad * 1.6;
  const out: ZoneShape[] = [];
  for (const ad of PROTECTED_AERODROMES) {
    if (!inView(ad.c)) continue;
    for (const z of frzParts(ad)) {
      if (z.kind === "atz") out.push({ id: ad.id, name: ad.name, level: "frz", kind: "circle", c: z.c, rM: z.rKm * 1000 });
      else if (z.kind === "rpz") {
        const [dx, dy] = z.dir, h = z.wKm / 2;
        const corner = (u: number, v: number) => fromKm(u * dx - v * dy, u * dy + v * dx, z.thr);
        out.push({ id: ad.id, name: ad.name, level: "frz", kind: "polygon", poly: [corner(0, -h), corner(RPZ_LEN_KM, -h), corner(RPZ_LEN_KM, h), corner(0, h)] });
      } else {
        // Boundary capsule: 1 km around the runway.
        const [x, y] = toKm(z.b, z.a);
        const L = Math.hypot(x, y) || 1, ux = x / L, uy = y / L;
        const poly: LatLon[] = [];
        for (let i = 0; i <= 16; i++) { const t = Math.PI / 2 + (Math.PI * i) / 16; poly.push(fromKm(BOUNDARY_KM * (Math.cos(t) * ux - Math.sin(t) * uy), BOUNDARY_KM * (Math.cos(t) * uy + Math.sin(t) * ux), z.a)); }
        for (let i = 0; i <= 16; i++) { const t = -Math.PI / 2 + (Math.PI * i) / 16; poly.push(fromKm(x + BOUNDARY_KM * (Math.cos(t) * ux - Math.sin(t) * uy), y + BOUNDARY_KM * (Math.cos(t) * uy + Math.sin(t) * ux), z.a)); }
        out.push({ id: ad.id, name: ad.name, level: "frz", kind: "polygon", poly });
      }
    }
  }
  for (const [id, name, lat, lon] of OTHER_AIRFIELDS) {
    if (inView([lat, lon])) out.push({ id, name, level: "airfield", kind: "circle", c: [lat, lon], rM: AIRFIELD_KM * 1000 });
  }
  return out;
}

export const AIRSPACE_COUNTS = { protected: PROTECTED_AERODROMES.length, airfields: OTHER_AIRFIELDS.length };
