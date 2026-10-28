import { THRESHOLDS, pct, type DroneProfile, type LatLon, type RouteContext, type RouteResult } from "@/lib/routeRisk";

const DEC = { go: "GO", caution: "CAUTION", nogo: "NO-GO" } as const;

export async function sha256Text(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function assessmentRecord(name: string, points: LatLon[], ctx: RouteContext, profile: DroneProfile, r: RouteResult) {
  return {
    method: r.method,
    route: { name, waypoints: points },
    flight: { start_utc: ctx.start.toISOString(), duration_min: ctx.durationMin },
    drone: profile,
    conditions: {
      active_venues: ctx.activeVenues.map((v) => v.name), space_weather: ctx.spaceWeather,
      dense_high_rise: ctx.denseHighRise, near_major_roads: ctx.nearMajorRoads, gates: ctx.gates,
      area_override: ctx.areaOverride, consequence_override: ctx.consequenceOverride,
      night: !!ctx.night, live_conditions: ctx.liveSummary ?? [], permissions_held: ctx.permissions ?? [], max_height_m: ctx.maxHeightM ?? 120, height_authorised: !!ctx.heightAuthorised,
    },
    airspace: r.airspace.map((h) => ({ id: h.id, name: h.name, level: h.level, parts: h.parts, sections: h.sections.map((i) => i + 1), permission_held: h.permitted })),
    result: {
      decision: DEC[r.decision], confidence: r.confidence, p_route: r.pRoute, total_km: r.totalKm, buffer_m: r.bufferM,
      sections: r.sections.map((s) => ({
        section: s.index + 1, length_km: +s.lengthKm.toFixed(2), decision: DEC[s.decision], confidence: s.confidence,
        p_interference: s.pInt, p_nav: s.pNav, vulnerability: s.v, p_loss: s.pLoss, consequence: s.consequence,
        aircraft_reports: s.adsb.n, degraded_reports: s.adsb.k, drivers: s.drivers.map((d) => `${d.label} ×${d.factor}`),
      })),
    },
    data_as_of: r.dataAsOf,
    generated_utc: new Date().toISOString(),
  };
}

export function downloadCsv(filename: string, r: RouteResult) {
  const head = ["section", "start_lat", "start_lon", "end_lat", "end_lon", "length_km", "decision", "confidence", "consequence_class", "p_interference", "p_nav", "vulnerability", "p_loss", "aircraft_reports", "degraded_reports", "events_nearby", "why"];
  const rows = r.sections.map((s) => [
    s.index + 1, s.start[0].toFixed(5), s.start[1].toFixed(5), s.end[0].toFixed(5), s.end[1].toFixed(5), s.lengthKm.toFixed(2),
    DEC[s.decision], s.confidence, s.consequence, s.pInt.toFixed(4), s.pNav.toFixed(4), s.v.toFixed(2), s.pLoss.toFixed(4),
    s.adsb.n, s.adsb.k, s.eventsNearby, `"${s.why.replace(/"/g, "'")}"`,
  ].join(","));
  saveBlob(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" }), filename);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const latin = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/×/g, "x").replace(/≈/g, "~").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/²/g, "2").replace(/[^\t\n\r -\u00ff]/g, "");

export async function downloadPdf(name: string, points: LatLon[], ctx: RouteContext, profile: DroneProfile, r: RouteResult) {
  const record = assessmentRecord(name, points, ctx, profile, r);
  const hash = await sha256Text(JSON.stringify(record));
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  let y = 18;
  const line = (txt: string, size = 9.5, bold = false, color: [number, number, number] = [30, 30, 30], gap = 4.6) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const w of doc.splitTextToSize(latin(txt), W - 2 * M) as string[]) {
      if (y > 282) { doc.addPage(); y = 18; }
      doc.text(w, M, y); y += gap;
    }
  };
  const heading = (t: string) => { y += 3; line(t, 11, true, [20, 30, 50], 6); };

  line("Witnessmark", 16, true, [20, 30, 50], 6);
  line("Witnessmark pre-flight check  ·  Pre-flight method v0.3", 9, false, [90, 90, 90]);
  line(`Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC  ·  Assessment fingerprint (SHA-256): ${hash}`, 7.5, false, [90, 90, 90], 4);
  doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 6;

  line(`Route: ${name}`, 11, true);
  line(`Planned start: ${ctx.start.toISOString().replace("T", " ").slice(0, 16)} UTC  ·  Duration: ${ctx.durationMin} min  ·  Length: ${r.totalKm.toFixed(2)} km in ${r.sections.length} sections`);
  y += 2;
  line(`OVERALL: ${DEC[r.decision]}  ·  ${r.confidence} confidence  ·  Chance of navigation loss along the route ~${pct(r.pRoute)}`, 12, true, r.decision === "go" ? [30, 110, 70] : r.decision === "caution" ? [150, 100, 0] : [170, 40, 35], 6);
  if (r.conditions.length) { heading("Conditions"); r.conditions.forEach((c) => line(`- ${c}`)); }

  if (ctx.liveSummary?.length) { heading("Conditions found automatically"); ctx.liveSummary.forEach((t) => line(`- ${t}`, 9)); }

  heading("Airspace");
  if (r.hardStops.length) r.hardStops.forEach((h) => line(`- HARD STOP: ${h}`, 9.5, false, [170, 40, 35]));
  if (r.airspace.length) r.airspace.forEach((h) => line(`- ${h.name} (${h.kindLabel}): ${h.parts.join(", ")}. ${h.permitted ? "Operator states permission is held." : h.permission}`, 9));
  else line("- No aerodrome flight restriction zones or airfields on the route (automatic check of 108 protected UK aerodromes; shapes approximate).", 9);
  if (r.londonRestricted) line("- Central London restricted areas R157-R159: boundaries not checked automatically; confirm with the NATS drone map.", 9);
  line(`- Planned max height: ${ctx.maxHeightM ?? 120} m above ground${(ctx.maxHeightM ?? 0) > 120 ? (ctx.heightAuthorised ? " (operator states a CAA operational authorisation covers this)" : " (above the 120 m open-category limit)") : ""}.`, 9);
  line("- Prisons, danger areas and temporary restrictions (NOTAMs) are not checked automatically: check the NATS drone map before flying.", 8.6, false, [60, 60, 60], 4.2);

  heading("Sections");
  for (const s of r.sections) {
    line(`Section ${s.index + 1} (${s.lengthKm.toFixed(2)} km): ${DEC[s.decision]}, ${s.confidence} confidence, ${s.consequence}`, 9.5, true);
    line(s.why, 8.8, false, [60, 60, 60], 4.2);
    if (s.drivers.length) line(`Drivers: ${s.drivers.slice(0, 3).map((d) => `${d.label} (x${d.factor})`).join("; ")}`, 8.5, false, [60, 60, 60], 4.2);
    y += 1.5;
  }

  heading("Drone profile");
  line(r.vFactors.length ? r.vFactors.map((f) => `${f.label} (x${f.factor})`).join("; ") : "GNSS-only drone, no mitigations declared (vulnerability 1.0).");
  line(`Vulnerability V = ${r.v.toFixed(2)}. Suggested extra ground-risk buffer: ~${r.bufferM} m (2 m/s drift over ${r.holdoverS} s holdover).`);

  heading("Thresholds used");
  (Object.keys(THRESHOLDS) as (keyof typeof THRESHOLDS)[]).forEach((c) => {
    const t = THRESHOLDS[c];
    line(`${c} ${t.density}: GO below ${pct(t.go)}, CAUTION ${pct(t.go)}-${pct(t.nogo)}, NO-GO from ${pct(t.nogo)}`, 8.8);
  });

  heading("Data and limitations");
  [
    `Aircraft data: Stanford GPS Laboratory (rfi.stanford.edu), CC BY-NC 4.0. Newest reading used: ${r.dataAsOf ? r.dataAsOf.replace("T", " ").slice(0, 16) + " UTC" : "none available"}.`,
    "Airspace: aerodrome zones are built from ANO 2016 arts 94A/94B and public runway coordinates (OurAirports); they approximate the official NATS shapes.",
    "Weather: Open-Meteo forecast (CC BY 4.0). Roads and buildings: OpenStreetMap (ODbL). Daylight is calculated from the sun's position.",
    "Event calendars are not connected; venue events are as declared by the operator.",
    "Population (ground consequence) uses a coarse London distance model unless overridden; replace with ONS/UKCEH census grids before operational use.",
    "Aircraft observe GPS quality at altitude and can miss low-power ground-level jammers. Witnessmark's own interference data is still being collected.",
    "All weights and thresholds are provisional (Pre-flight method v0.3) and have not been validated against real flights.",
    "Decision support only. The remote pilot and operator remain responsible for the flight and for their CAA safety case.",
  ].forEach((t) => line(`- ${t}`, 8.6, false, [60, 60, 60], 4.2));

  doc.save(`Witnessmark-route-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
