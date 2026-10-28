import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Undo2, Trash2, Upload, Pencil, FileDown, Table2, ChevronDown, Loader2, AlertCircle, Satellite } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/wm/Page";
import { ConfidenceMeter, Eyebrow, StatusPill, btn, type Status } from "@/components/wm/ui";
import { seo } from "@/lib/seo";
import { TABLE_ACCEPT, checkTableName, readTableFile } from "@/lib/tabular";
import { takePendingFile } from "@/lib/pendingFile";
import {
  AREA_LABEL, DEFAULT_PROFILE, LONDON_VENUES, THRESHOLDS, VULNERABILITY, assessRoute, kmBetween, pct,
  type AreaType, type ConsequenceClass, type DroneProfile, type Gates, type LatLon, type RouteContext, type SpaceWeather, type VulnKey,
} from "@/lib/routeRisk";
import { downloadCsv, downloadPdf } from "@/lib/routeExport";

const RouteMap = lazy(() => import("@/components/routes/RouteMap"));

export const Route = createFileRoute("/pre-flight/check")({
  head: () => ({ meta: seo({ title: "Check a route", description: "Draw a drone route and get GO / CAUTION / NO-GO for GPS interference on every section, with confidence, reasons and a PDF for your safety case." }) }),
  component: RouteCheck,
});

type Preset = { id: string; name: string; note: string; points: LatLon[]; start?: string; venue?: string };
const PRESETS: Preset[] = [
  { id: "hospitals", name: "St Thomas' → Guy's hospital link", note: "2.8 km over central London", points: [[51.4988, -0.1189], [51.5065, -0.11], [51.508, -0.098], [51.5034, -0.087]] },
  { id: "wembley", name: "Wembley corridor on match day", note: "Passes 1 km from Wembley Stadium", points: [[51.545, -0.305], [51.556, -0.29], [51.564, -0.265]], venue: "wembley" },
  { id: "rural", name: "Oxfordshire field survey", note: "Rural, sparse ground", points: [[51.7, -1.3], [51.712, -1.27], [51.724, -1.245]] },
  { id: "baltic", name: "Gdańsk Bay (Baltic demo data)", note: "Simulated jamming event in the database", points: [[54.36, 18.42], [54.38, 18.47], [54.4, 18.53]], start: "2026-09-20T15:30:00Z" },
];

const DEC_STATUS: Record<"go" | "caution" | "nogo", Status> = { go: "go", caution: "caution", nogo: "nogo" };

function nextHourLocal() {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function utcToLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type RouteFile = { points: LatLon[]; start?: string; venue?: string };

/** lat,lon per row. Optional columns on the first row: planned_start (ISO time) and event_venue (e.g. wembley). */
function parseRouteCsv(text: string): RouteFile | string {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return "The file needs a header row (lat,lon) and at least two waypoints.";
  const delim = lines[0]!.includes(";") ? ";" : ",";
  const head = lines[0]!.split(delim).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const la = head.findIndex((h) => h === "lat" || h === "latitude"), lo = head.findIndex((h) => h === "lon" || h === "lng" || h === "longitude");
  if (la < 0 || lo < 0) return "The file needs 'lat' and 'lon' columns.";
  const ps = head.indexOf("planned_start"), ve = head.indexOf("event_venue");
  const pts: LatLon[] = [];
  let start: string | undefined, venue: string | undefined;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i]!.split(delim).map((x) => x.trim().replace(/"/g, ""));
    const a = Number(c[la]), b = Number(c[lo]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return `Row ${i + 1}: lat/lon missing or out of range.`;
    pts.push([a, b]);
    if (ps >= 0 && !start && c[ps]) {
      if (Number.isNaN(Date.parse(c[ps]!))) return `Row ${i + 1}: planned_start must be an ISO time, e.g. 2026-09-20T15:30:00Z.`;
      start = new Date(c[ps]!).toISOString();
    }
    if (ve >= 0 && !venue && c[ve]) venue = c[ve]!.toLowerCase();
  }
  if (pts.length > 500) return "Up to 500 waypoints, please.";
  if (venue && !LONDON_VENUES.some((v) => v.id === venue)) return `Unknown event_venue "${venue}". Use one of: ${LONDON_VENUES.map((v) => v.id).join(", ")}.`;
  return { points: pts, ...(start ? { start } : {}), ...(venue ? { venue } : {}) };
}

function useSpaceWeather() {
  return useQuery({
    queryKey: ["swpc-kp"],
    staleTime: 30 * 60000,
    retry: 0,
    queryFn: async () => {
      const res = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json");
      if (!res.ok) throw new Error("unavailable");
      const rows = (await res.json()) as unknown[];
      const now = Date.now(), until = now + 24 * 3600000;
      let max = 0;
      for (const r of rows) {
        let t: number, kp: number;
        if (Array.isArray(r)) { t = Date.parse(String(r[0]).replace(" ", "T") + "Z"); kp = Number(r[1]); }
        else if (r && typeof r === "object") { const o = r as Record<string, unknown>; t = Date.parse(String(o["time_tag"]) + (String(o["time_tag"]).endsWith("Z") ? "" : "Z")); kp = Number(o["kp"]); }
        else continue;
        if (Number.isFinite(t) && Number.isFinite(kp) && t >= now - 3 * 3600000 && t <= until) max = Math.max(max, kp);
      }
      return { maxKp: max };
    },
  });
}

function RouteCheck() {
  const [points, setPoints] = useState<LatLon[]>(PRESETS[0]!.points);
  const [routeName, setRouteName] = useState(PRESETS[0]!.name);
  const [fitToken, setFitToken] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [startLocal, setStartLocal] = useState(nextHourLocal);
  const [durationMin, setDurationMin] = useState(20);
  const [sectionKm, setSectionKm] = useState(0.5);
  const [profile, setProfile] = useState<DroneProfile>({ ...DEFAULT_PROFILE, multiBand: true, flagsAndFailsafe: true });
  const [activeVenues, setActiveVenues] = useState<string[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeather>("quiet");
  const [denseHighRise, setDenseHighRise] = useState(false);
  const [nearMajorRoads, setNearMajorRoads] = useState(false);
  const [areaOverride, setAreaOverride] = useState<AreaType | "auto">("auto");
  const [consequenceOverride, setConsequenceOverride] = useState<ConsequenceClass | "auto">("auto");
  const [gates, setGates] = useState<Gates>({ notamRed: false, restrictedNoPermission: false, weatherOutside: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kp = useSpaceWeather();

  useEffect(() => {
    if (kp.data) setSpaceWeather(kp.data.maxKp >= 8 ? "g4" : kp.data.maxKp >= 7 ? "g3" : "quiet");
  }, [kp.data]);

  const start = useMemo(() => {
    const d = new Date(startLocal);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [startLocal]);
  const lookbackDays = 30;

  const bbox = useMemo(() => {
    if (points.length < 2) return null;
    const lats = points.map((p) => p[0]), lons = points.map((p) => p[1]);
    const r = (n: number) => Math.round(n * 100) / 100;
    return { minLat: r(Math.min(...lats) - 0.15), maxLat: r(Math.max(...lats) + 0.15), minLon: r(Math.min(...lons) - 0.25), maxLon: r(Math.max(...lons) + 0.25) };
  }, [points]);

  const startHour = Math.floor(start.getTime() / 3600000) * 3600000;
  const sky = useQuery({
    queryKey: ["route-sky", bbox, startHour, durationMin],
    enabled: !!bbox,
    staleTime: 5 * 60000,
    queryFn: async () => {
      const since = new Date(startHour - lookbackDays * 86400000).toISOString();
      const until = new Date(startHour).toISOString();
      const end = new Date(startHour + (durationMin + 60) * 60000).toISOString();
      const [hx, ev] = await Promise.all([
        supabase.from("sky_hexes").select("hour,lat,lon,low_quality_count,total_count")
          .gte("hour", since).lte("hour", until)
          .gte("lat", bbox!.minLat).lte("lat", bbox!.maxLat).gte("lon", bbox!.minLon).lte("lon", bbox!.maxLon).limit(10000),
        supabase.from("sky_events").select("type,lat,lon,start_time,end_time")
          .lte("start_time", end).gte("end_time", since)
          .gte("lat", bbox!.minLat - 0.5).lte("lat", bbox!.maxLat + 0.5).gte("lon", bbox!.minLon - 0.8).lte("lon", bbox!.maxLon + 0.8).limit(2000),
      ]);
      if (hx.error) throw hx.error;
      if (ev.error) throw ev.error;
      return { hexes: hx.data ?? [], events: ev.data ?? [] };
    },
  });

  const nearbyVenues = useMemo(
    () => LONDON_VENUES.filter((v) => points.some((p) => kmBetween(p, [v.lat, v.lon]) <= 5)),
    [points],
  );

  const ctx: RouteContext = useMemo(() => ({
    start, durationMin, hexes: sky.data?.hexes ?? [], events: sky.data?.events ?? [],
    activeVenues: LONDON_VENUES.filter((v) => activeVenues.includes(v.id)),
    spaceWeather, denseHighRise, nearMajorRoads, gates, areaOverride, consequenceOverride, lookbackDays,
  }), [start, durationMin, sky.data, activeVenues, spaceWeather, denseHighRise, nearMajorRoads, gates, areaOverride, consequenceOverride]);

  const result = useMemo(() => (points.length >= 2 && sky.data ? assessRoute(points, sectionKm, ctx, profile) : null), [points, sectionKm, ctx, profile, sky.data]);

  function loadPreset(p: Preset) {
    setPoints(p.points); setRouteName(p.name); setFitToken((t) => t + 1); setSelected(null); setDrawing(false); setFileErr(null);
    setActiveVenues(p.venue ? [p.venue] : []);
    setStartLocal(p.start ? utcToLocalInput(p.start) : nextHourLocal());
  }
  function loadRouteText(text: string, name: string) {
    const r = parseRouteCsv(text);
    if (typeof r === "string") return setFileErr(r);
    setPoints(r.points); setRouteName(name.replace(/\.(csv|xlsx)$/i, "")); setFitToken((t) => t + 1); setSelected(null); setDrawing(false);
    if (r.start) setStartLocal(utcToLocalInput(r.start));
    setActiveVenues(r.venue ? [r.venue] : []);
  }
  async function onFile(f: File) {
    setFileErr(null);
    const bad = checkTableName(f.name);
    if (bad) return setFileErr(bad);
    if (f.size > 1_000_000) return setFileErr("File too large (max 1 MB).");
    try { loadRouteText((await readTableFile(f)).text, f.name); } catch (e) { setFileErr(e instanceof Error ? e.message : "Couldn't read that file."); }
  }
  // A route dropped on the demo page arrives here.
  useEffect(() => {
    const p = takePendingFile("route");
    if (p) loadRouteText(p.text, p.name);
  }, []);
  const toggle = (k: VulnKey) => setProfile((p) => ({ ...p, [k]: !p[k] }));
  const sel = result && selected !== null ? result.sections[selected] : null;

  return (
    <Page>
      <div className="border-b">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-6 pb-6 pt-10 sm:px-8">
          <div>
            <Eyebrow>Witnessmark · Pre-flight method v0.2</Eyebrow>
            <h1 className="mt-3 text-[30px] leading-[36px] sm:text-[40px] sm:leading-[48px]">Check a route</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Draw or load a route, describe the drone, and get GO / CAUTION / NO-GO for GPS interference on every section.</p>
          </div>
          <Link to="/pre-flight" className={btn.text}>How it works →</Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_460px]">
        {/* MAP */}
        <div className="relative h-[52vh] min-h-[340px] border-b lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-card" />}>
            <Suspense fallback={<div className="h-full animate-pulse bg-card" />}>
              <RouteMap
                points={points} result={result} venues={nearbyVenues} activeVenueIds={activeVenues}
                selected={selected} onSelect={setSelected} drawing={drawing} fitToken={fitToken}
                onAdd={(p) => { setPoints((ps) => [...ps, p]); setSelected(null); setRouteName((n) => (n.startsWith("Custom") ? n : "Custom route")); }}
              />
            </Suspense>
          </ClientOnly>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap gap-2">
            <div className="pointer-events-auto flex gap-1 rounded-lg border bg-background/90 p-1 backdrop-blur">
              <button type="button" onClick={() => setDrawing((d) => !d)} aria-pressed={drawing}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm ${drawing ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-foreground/[0.06]"}`}>
                <Pencil className="h-4 w-4" /> {drawing ? "Click map to add points" : "Draw"}
              </button>
              <button type="button" onClick={() => { setPoints((p) => p.slice(0, -1)); setSelected(null); }} disabled={!points.length}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-foreground/[0.06] disabled:opacity-40" aria-label="Undo last point">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setPoints([]); setSelected(null); setDrawing(true); setRouteName("Custom route"); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-foreground/[0.06]" aria-label="Clear route">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {result && (
            <div className="pointer-events-none absolute bottom-8 left-3 z-[500] rounded-lg border bg-background/90 px-3 py-2 text-xs backdrop-blur">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded bg-good" /> GO</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded bg-warn" /> CAUTION</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded bg-bad" /> NO-GO</span>
                <span className="text-subtle">dashed = low confidence</span>
              </p>
            </div>
          )}
        </div>

        {/* PANEL */}
        <div className="min-w-0">
          {/* Verdict */}
          <section aria-live="polite" className="border-b px-6 py-6 sm:px-8">
            {points.length < 2 ? (
              <p className="text-muted-foreground">Add at least two points to the map, load an example route or upload a CSV to see a result.</p>
            ) : sky.isLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking aircraft data along the route…</p>
            ) : sky.error ? (
              <p className="flex items-start gap-2 text-bad"><AlertCircle className="mt-0.5 h-4 w-4" /> Couldn't load aircraft data. Check your connection and try again.</p>
            ) : result && (
              <>
                <p className="text-sm text-muted-foreground">{routeName} · {result.totalKm.toFixed(2)} km · {result.sections.length} sections</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StatusPill status={DEC_STATUS[result.decision]} size="lg" />
                  <ConfidenceMeter level={result.confidence} />
                </div>
                <p className="mt-3 text-[15px]">
                  {result.routeLevelNote
                    ? result.routeLevelNote
                    : result.decision === "go"
                      ? "Every section is below the GO threshold for the ground beneath it."
                      : `${result.sections.filter((s) => s.decision !== "go").length} of ${result.sections.length} sections need attention. Worst: section ${result.worstIndex + 1}.`}
                  {" "}Chance of losing trustworthy navigation somewhere on the route: <span className="font-mono">{/^[<>]/.test(pct(result.pRoute)) ? pct(result.pRoute) : `≈ ${pct(result.pRoute)}`}</span>.
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-subtle">
                  Aircraft data as of {result.dataAsOf ? result.dataAsOf.replace("T", " ").slice(0, 16) + " UTC" : "— none for this area and window"}
                </p>
                {result.conditions.length > 0 && (
                  <div className="mt-5">
                    <p className="text-sm font-medium">To fly, consider</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{result.conditions.map((c) => <li key={c}>– {c}</li>)}</ul>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" className={btn.secondary} disabled={exporting}
                    onClick={async () => { setExporting(true); try { await downloadPdf(routeName, points, ctx, profile, result); } finally { setExporting(false); } }}>
                    <FileDown className="h-4 w-4" /> {exporting ? "Preparing…" : "Safety-case PDF"}
                  </button>
                  <button type="button" className={btn.secondary} onClick={() => downloadCsv(`witnessmark-route-sections.csv`, result)}>
                    <Table2 className="h-4 w-4" /> CSV
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Sections */}
          {result && (
            <section className="border-b px-6 py-6 sm:px-8" aria-labelledby="sections-h">
              <h2 id="sections-h" className="text-lg">Sections</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select a section for the reasons behind it.</p>
              <ol className="mt-4 divide-y rounded-lg border">
                {result.sections.map((s) => (
                  <li key={s.index}>
                    <button type="button" onClick={() => setSelected(selected === s.index ? null : s.index)} aria-expanded={selected === s.index}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-foreground/[0.04] ${selected === s.index ? "bg-foreground/[0.05]" : ""}`}>
                      <span className="w-6 font-mono text-subtle">{s.index + 1}</span>
                      <StatusPill status={DEC_STATUS[s.decision]} size="sm" />
                      <span className="flex-1 text-muted-foreground">{s.lengthKm.toFixed(2)} km · {s.consequence} · {s.confidence}</span>
                      <span className="font-mono text-xs">{pct(s.pLoss)}</span>
                      <ChevronDown className={`h-4 w-4 text-subtle transition-transform ${selected === s.index ? "rotate-180" : ""}`} />
                    </button>
                    {sel && sel.index === s.index && (
                      <div className="space-y-3 border-t bg-card px-4 py-4 text-sm">
                        <p>{s.why}</p>
                        {s.drivers.length > 0 && (
                          <div>
                            <p className="font-medium">Top drivers</p>
                            <ul className="mt-1 space-y-1 text-muted-foreground">
                              {s.drivers.slice(0, 4).map((d) => <li key={d.label} className="flex justify-between gap-3"><span>{d.label}</span><span className="font-mono">×{d.factor}</span></li>)}
                            </ul>
                          </div>
                        )}
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                          <dt>Area prior</dt><dd>{pct(s.prior)} · {AREA_LABEL[s.area]} ({s.areaSource})</dd>
                          <dt>P(interference)</dt><dd>{pct(s.pInt)}</dd>
                          <dt>P(nav degraded)</dt><dd>{pct(s.pNav)}</dd>
                          <dt>Vulnerability</dt><dd>{s.v.toFixed(2)}</dd>
                          <dt>P(loss)</dt><dd>{pct(s.pLoss)}</dd>
                          <dt>Ground</dt><dd>{s.consequence} · {THRESHOLDS[s.consequence].density} ({s.consequenceSource})</dd>
                          <dt>Aircraft reports</dt><dd>{s.adsb.n} ({s.adsb.k} degraded)</dd>
                        </dl>
                        {s.notes.length > 0 && <ul className="space-y-1 text-xs text-subtle">{s.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Inputs */}
          <div className="divide-y">
            <Fieldset title="1 · Route">
              <div className="grid gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => loadPreset(p)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/40 ${routeName === p.name ? "border-primary/70 bg-primary/[0.06]" : ""}`}>
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.note}</span>
                  </button>
                ))}
              </div>
              <input ref={fileRef} type="file" accept={TABLE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} className={`${btn.text} mt-3`}><Upload className="h-4 w-4" /> Upload a route (CSV or Excel with lat, lon)</button>
              {fileErr && <p role="alert" className="mt-2 text-sm text-bad">{fileErr}</p>}
              <p className="mt-2 text-xs text-subtle">Example routes are illustrative, not real flight plans. <Link to="/demo" hash="pre-flight" className="underline underline-offset-2 hover:text-foreground">Sample route files and the format</Link></p>
            </Fieldset>

            <Fieldset title="2 · Flight">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Planned start (your time)">
                  <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className={inputCls} />
                </Field></div>
                <Field label="Duration (minutes)">
                  <input type="number" min={1} max={600} value={durationMin} onChange={(e) => setDurationMin(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} className={inputCls} />
                </Field>
                <Field label="Section length">
                  <select value={sectionKm} onChange={(e) => setSectionKm(Number(e.target.value))} className={inputCls}>
                    <option value={0.25}>250 m</option><option value={0.5}>500 m</option><option value={1}>1 km</option><option value={2}>2 km</option>
                  </select>
                </Field>
              </div>
            </Fieldset>

            <Fieldset title="3 · Drone">
              <div className="space-y-2">
                {(Object.keys(VULNERABILITY) as VulnKey[]).map((k) => (
                  <Check key={k} checked={profile[k]} onChange={() => toggle(k)} label={VULNERABILITY[k].label} hint={`×${VULNERABILITY[k].factor}`} />
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Time to a safe landing (s)">
                  <input type="number" min={0} placeholder="e.g. 45" value={profile.timeToLandS ?? ""} onChange={(e) => setProfile((p) => ({ ...p, timeToLandS: e.target.value === "" ? null : Number(e.target.value) }))} className={inputCls} />
                </Field>
                <Field label="Dead-reckoning limit (s)">
                  <input type="number" min={0} placeholder="e.g. 10" value={profile.deadReckonLimitS ?? ""} onChange={(e) => setProfile((p) => ({ ...p, deadReckonLimitS: e.target.value === "" ? null : Number(e.target.value) }))} className={inputCls} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-subtle">PX4: EKF2_NOAID_TOUT · ArduPilot: FS_DR_TIMEOUT.</p>
            </Fieldset>

            <Fieldset title="4 · Conditions">
              <p className="text-sm font-medium">Events during the flight window</p>
              <p className="mt-1 text-xs text-subtle">Event calendars aren't connected yet. Tick any events you know about near the route.</p>
              {nearbyVenues.length ? (
                <div className="mt-2 space-y-2">
                  {nearbyVenues.map((v) => (
                    <Check key={v.id} checked={activeVenues.includes(v.id)} onChange={() => setActiveVenues((a) => (a.includes(v.id) ? a.filter((x) => x !== v.id) : [...a, v.id]))} label={v.name} hint={v.kind} />
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">No major London venues within 5 km of this route.</p>}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Space weather (next 24 h)">
                  <select value={spaceWeather} onChange={(e) => setSpaceWeather(e.target.value as SpaceWeather)} className={inputCls}>
                    <option value="quiet">Quiet or minor (below G3)</option><option value="g3">Strong storm (G3, Kp 7)</option><option value="g4">Severe storm (G4+, Kp 8+)</option>
                  </select>
                </Field>
                <div className="flex items-end pb-2 text-xs text-subtle">
                  <span className="flex items-center gap-1.5"><Satellite className="h-3.5 w-3.5" />
                    {kp.isLoading ? "Checking NOAA…" : kp.data ? `NOAA SWPC forecast: max Kp ${kp.data.maxKp.toFixed(1)}` : "NOAA unreachable — set manually"}
                  </span>
                </div>
                <Field label="Area type (sets the base rate)">
                  <select value={areaOverride} onChange={(e) => setAreaOverride(e.target.value as AreaType | "auto")} className={inputCls}>
                    <option value="auto">Automatic (London model)</option><option value="central">Dense city centre</option><option value="urban">Urban / suburban</option><option value="rural">Rural</option>
                  </select>
                </Field>
                <Field label="Ground consequence">
                  <select value={consequenceOverride} onChange={(e) => setConsequenceOverride(e.target.value as ConsequenceClass | "auto")} className={inputCls}>
                    <option value="auto">Automatic (London model)</option>
                    {(Object.keys(THRESHOLDS) as ConsequenceClass[]).map((c) => <option key={c} value={c}>{c} · {THRESHOLDS[c].density}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-3 space-y-2">
                <Check checked={denseHighRise} onChange={() => setDenseHighRise((v) => !v)} label="Dense high-rise along the route (poor satellite view)" />
                <Check checked={nearMajorRoads} onChange={() => setNearMajorRoads((v) => !v)} label="Route follows or crosses major roads (in-car jammers)" hint="×1.5" />
              </div>
            </Fieldset>

            <Fieldset title="5 · Hard stops">
              <p className="mb-2 text-xs text-subtle">Any of these makes the whole route NO-GO, whatever the numbers say.</p>
              <div className="space-y-2">
                <Check checked={gates.notamRed} onChange={() => setGates((g) => ({ ...g, notamRed: !g.notamRed }))} label="Route is inside a notified GNSS-interference area (NOTAM or red AIC area)" />
                <Check checked={gates.restrictedNoPermission} onChange={() => setGates((g) => ({ ...g, restrictedNoPermission: !g.restrictedNoPermission }))} label="Route enters restricted airspace / FRZ without permission" />
                <Check checked={gates.weatherOutside} onChange={() => setGates((g) => ({ ...g, weatherOutside: !g.weatherOutside }))} label="Weather is outside the drone's limits" />
              </div>
            </Fieldset>

            <div className="px-6 py-6 text-xs leading-5 text-subtle sm:px-8">
              Decision support only. Aircraft see GPS quality at altitude and can miss low-power jammers near the ground; Witnessmark's own interference data is not yet includedd yet. Ground consequence uses a coarse London model unless you override it. All weights are provisional. <Link to="/method" hash="pre-flight" className="underline">Read the method</Link>.
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

const inputCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground";

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 px-6 py-6 sm:px-8">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="eyebrow mb-4">{title}</p>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-foreground/[0.03]">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
      <span className="flex-1">{label}</span>
      {hint && <span className="font-mono text-xs text-subtle">{hint}</span>}
    </label>
  );
}
