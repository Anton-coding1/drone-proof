import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Upload, Loader2, AlertCircle, RadioTower, ShieldAlert, ShieldCheck } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, Eyebrow, StatusPill, btn } from "@/components/wm/ui";
import { detect, describe, minuteSeries, parseSensorCsv, SENSOR_COLUMNS, type Epoch, type SiteEvent } from "@/lib/siteMonitor";
import { seo } from "@/lib/seo";
import { SENSOR_SAMPLES } from "@/lib/demoFiles";

export const Route = createFileRoute("/monitor")({
  head: () => ({ meta: seo({ title: "Site monitoring", description: "Upload a ground sensor log and see every GPS jamming or spoofing event Witnessmark finds, with its evidence and confidence." }) }),
  component: Monitor,
});


type Loaded = { name: string; sample: boolean; epochs: Epoch[]; events: SiteEvent[] };

const hhmm = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);
const utc = (t: number) => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const dur = (s: number) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

function Monitor() {
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function run(text: string, name: string, sample: boolean) {
    const r = parseSensorCsv(text);
    if ("error" in r) { setErr(r.error); setData(null); return; }
    setData({ name, sample, epochs: r.epochs, events: detect(r.epochs) });
  }
  async function onFile(f: File) {
    setErr(null);
    if (f.size > 8_000_000) return setErr("File too large: maximum 8 MB.");
    if (!/\.csv$/i.test(f.name)) return setErr("Please choose a .csv file.");
    setBusy(true);
    try { run(await f.text(), f.name, false); } finally { setBusy(false); }
  }
  async function loadSample(file: string, name: string) {
    setErr(null); setBusy(true);
    try {
      const res = await fetch(`/demo-data/${file}`);
      if (!res.ok) throw new Error();
      run(await res.text(), name, true);
    } catch { setErr("Couldn't load the sample. Please try again."); } finally { setBusy(false); }
  }

  return (
    <Page>
      <div className="border-b">
        <Container className="py-10 sm:py-12">
          <Eyebrow>Witnessmark · Site monitoring · Sensor method v0.1</Eyebrow>
          <h1 className="mt-3 text-[30px] leading-[36px] sm:text-[40px] sm:leading-[48px]">Site monitoring</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Upload a log from a ground sensor and see every GPS jamming or spoofing event it caught, with the evidence and a confidence level. The file is analysed in your browser and never leaves your device.</p>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Input */}
        <div className="space-y-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }}
            className={`rounded-xl border border-dashed p-6 text-center transition-colors ${drag ? "border-foreground/70 bg-foreground/[0.03]" : "border-foreground/25"}`}
          >
            {busy ? <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" aria-hidden="true" /> : <Upload className="mx-auto h-7 w-7 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />}
            <p className="mt-3 font-medium">Upload a sensor log</p>
            <p className="mt-1 text-xs text-subtle">CSV, one row per second, up to 8 MB</p>
            <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${btn.primary} mt-4 w-full`}>Choose file</button>
          </div>
          {err && <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad/40 p-3 text-sm text-bad"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{err}</p>}

          <div>
            <p className="eyebrow">Or try a sample</p>
            <ul className="mt-3 space-y-2">
              {SENSOR_SAMPLES.map((s) => (
                <li key={s.file}>
                  <button type="button" disabled={busy} onClick={() => void loadSample(s.file, s.name)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors hover:border-foreground/40 ${data?.name === s.name ? "border-foreground/70 bg-foreground/[0.05]" : ""}`}>
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">{s.note}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">Samples are simulated. <Link to="/demo" hash="sites" className="underline underline-offset-2 hover:text-foreground">Download them and see the file format</Link></p>
          </div>

          <details className="rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer font-medium">File format</summary>
            <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{SENSOR_COLUMNS.join(", ")}</p>
            <p className="mt-2 text-xs text-subtle">Only time and cno_top are required. The Witnessmark sensor software writes this format.</p>
          </details>
        </div>

        {/* Results */}
        <div className="min-w-0">
          {!data ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border bg-card p-10 text-center">
              <RadioTower className="h-8 w-8 text-subtle" strokeWidth={1.25} aria-hidden="true" />
              <p className="mt-4 font-medium">No log loaded yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Upload a sensor log, or pick a sample on the left, to see what the sensor caught.</p>
            </div>
          ) : (
            <Results data={data} />
          )}
        </div>
      </Container>
    </Page>
  );
}

function Results({ data }: { data: Loaded }) {
  const series = useMemo(() => minuteSeries(data.epochs), [data.epochs]);
  const first = data.epochs[0]!.t, last = data.epochs[data.epochs.length - 1]!.t;
  const span = last - first;
  const learnedAt = first + 30 * 60;
  const n = data.events.length;
  return (
    <div className="space-y-6" aria-live="polite">
      <div className="rounded-2xl border bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{data.name}{data.sample && <span className="ml-2 rounded-full border border-warn/40 px-2 py-0.5 font-mono text-[11px] text-warn">Simulated sample</span>}</p>
          <p className="font-mono text-xs text-subtle">{data.epochs.length.toLocaleString()} readings · {dur(span)}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {n === 0 ? <StatusPill status="go" label="NO INTERFERENCE FOUND" size="lg" /> : <StatusPill status="nogo" label={`${n} EVENT${n > 1 ? "S" : ""} FOUND`} size="lg" />}
        </div>
        <p className="mt-4 text-[15px] leading-6">
          {n === 0
            ? "Signals stayed within this site's normal range for the whole log."
            : `${data.events.map((e) => `${e.kind === "jamming" ? "Jamming" : "Spoofing"} at ${hhmm(e.start)} UTC for ${dur(e.end - e.start)}`).join("; ")}.`}
        </p>
        {span < 35 * 60 && <p className="mt-2 text-sm text-warn">This log is shorter than 35 minutes. The sensor needs 30 minutes to learn the site before it can flag signal changes.</p>}
      </div>

      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <p className="text-sm font-medium">Signal strength over time</p>
        <p className="mt-1 text-xs text-subtle">Average strength of the strongest satellites, per minute (dB-Hz). Shaded bands are detected events; the first 30 minutes are the learning period.</p>
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer>
            <ComposedChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={hhmm} stroke="#868D98" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={["dataMin - 4", "dataMax + 2"]} stroke="#868D98" fontSize={11} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ReferenceArea x1={first} x2={Math.min(learnedAt, last)} fill="#ffffff" fillOpacity={0.03} stroke="none" label={{ value: "Learning", fill: "#868D98", fontSize: 11, position: "insideTopLeft" }} />
              {data.events.map((e) => (
                <ReferenceArea key={e.start} x1={e.start} x2={e.end} fill={e.kind === "jamming" ? "#E5574F" : "#E0A84A"} fillOpacity={0.16} stroke="none"
                  label={{ value: e.kind === "jamming" ? "Jamming" : "Spoofing", fill: e.kind === "jamming" ? "#F39A93" : "#E0A84A", fontSize: 11, position: "insideTop" }} />
              ))}
              <Tooltip contentStyle={{ background: "#121316", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} labelFormatter={(t) => `${hhmm(Number(t))} UTC`} formatter={(v) => [`${v} dB-Hz`, "Signal strength"]} />
              <Line dataKey="cno" stroke="#7DB6FF" strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.events.length > 0 && (
        <div className="space-y-3">
          <p className="eyebrow">Events</p>
          {data.events.map((e, i) => (
            <div key={e.start} className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldAlert className={`h-4 w-4 ${e.kind === "jamming" ? "text-bad" : "text-warn"}`} aria-hidden="true" />
                  Event {i + 1}: {e.kind === "jamming" ? "Jamming" : "Spoofing"}
                </p>
                <span className="text-sm text-muted-foreground">{e.confidence} confidence</span>
              </div>
              <p className="mt-2 font-mono text-xs text-subtle">{utc(e.start)} → {utc(e.end)} · {dur(e.end - e.start)}{e.closedByGap ? " · ended by a gap in the data" : ""}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {describe(e).map((l) => <li key={l} className="flex gap-2"><span aria-hidden="true">·</span>{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        <p>An event needs at least two independent signs together for 5 seconds. Thresholds are provisional and have been tested on simulated data only. <Link to="/method" hash="sensors" className="text-foreground underline underline-offset-4">How the sensor decides</Link></p>
      </div>
    </div>
  );
}
