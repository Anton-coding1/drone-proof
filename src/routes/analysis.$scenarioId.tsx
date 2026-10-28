import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, X, Minus, FileDown, Link2, Loader2, ShieldCheck, ShieldAlert, Upload, Sparkles } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Page } from "@/components/wm/Page";
import { ConfidenceMeter, DemoBanner, Eyebrow, HashField, btn } from "@/components/wm/ui";
import { caseId, caseQuery, mmss, utc, type CasePoint } from "@/lib/cases";
import { VERDICTS, type Analysis, type CheckResult, type Rule, type VerdictKey } from "@/lib/evidence";
import { appendAudit, EMPTY_REVIEW, loadCaseState, saveCaseState, verifyAudit, type CaseState } from "@/lib/caseLog";
import { sha256Hex } from "@/lib/csv";
import { generateReport } from "@/lib/report.functions";
import { downloadCasePdf } from "@/lib/casePdf";
import { METHOD_VERSION } from "@/lib/site";
import { seo } from "@/lib/seo";

const FlightMap = lazy(() => import("@/components/FlightMap"));

export const Route = createFileRoute("/analysis/$scenarioId")({
  head: () => ({ meta: seo({ title: "Case file", description: "A Witnessmark case file: finding, confidence, evidence, exhibits, fingerprint, reviewer sign-off and audit trail.", type: "article", noindex: true }) }),
  component: CaseFile,
});

function CaseFile() {
  const { scenarioId } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery(caseQuery(scenarioId));

  if (isLoading) {
    return (
      <Page>
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8" aria-busy="true">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-12 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-10 h-72 animate-pulse rounded-xl bg-card" />
          <p className="mt-6 text-center text-sm text-muted-foreground">Checking the drone log and the sky overhead…</p>
        </div>
      </Page>
    );
  }
  if (error) return <Empty title="We couldn't load this case" body="Check your connection and try again." action={<button type="button" className={btn.secondary} onClick={() => refetch()}>Try again</button>} />;
  if (!data?.scenario) return <Empty title="Case not found" body="This case may have been removed, or the link is incomplete." />;
  if (!data.analysis) return <Empty title="Not enough flight data" body="This log has fewer than two GPS readings, so there is nothing to analyse. Try uploading the full log again." />;

  return <CaseView id={scenarioId} scenario={data.scenario} points={data.points} analysis={data.analysis} />;
}

type Scenario = { id: string; name: string; description: string | null; location_name: string | null; is_simulated: boolean; created_at: string; file_sha256: string | null; source_filename: string | null };

function CaseView({ id, scenario, points, analysis: a }: { id: string; scenario: Scenario; points: CasePoint[]; analysis: Analysis }) {
  const cid = caseId(id);
  const [state, setState] = useState<CaseState>({ audit: [], review: EMPTY_REVIEW, claimRef: "" });
  const [ready, setReady] = useState(false);
  const [dataHash, setDataHash] = useState("");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const fingerprint = scenario.file_sha256 ?? dataHash;
  const fingerprintKind = scenario.file_sha256 ? "File fingerprint (SHA-256 of the original upload)" : "Data fingerprint (SHA-256 of the stored flight points)";

  useEffect(() => {
    if (!scenario.file_sha256) {
      const enc = new TextEncoder().encode(JSON.stringify(points)).buffer as ArrayBuffer;
      sha256Hex(enc).then(setDataHash);
    }
  }, [points, scenario.file_sha256]);

  // Load this browser's review and audit trail; seed the trail the first time the case is opened here.
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = loadCaseState(id);
      if (!s.audit.length) {
        let audit = await appendAudit([], { actor: "System", action: scenario.is_simulated ? "Demo case created" : "Flight log received", detail: scenario.source_filename ?? scenario.name, at: scenario.created_at });
        if (scenario.file_sha256) audit = await appendAudit(audit, { actor: "System", action: "Fingerprint recorded", detail: `SHA-256 ${scenario.file_sha256.slice(0, 16)}…`, at: scenario.created_at });
        audit = await appendAudit(audit, { actor: "System", action: `Analysis run (Method ${METHOD_VERSION})`, detail: `${a.v.title} · ${a.v.confidence} confidence` });
        s.audit = audit;
        saveCaseState(id, s);
      }
      if (alive) { setState(s); setReady(true); }
    })();
    return () => { alive = false; };
  }, [id, scenario, a.v.title, a.v.confidence]);

  // Audit writes are queued so two quick actions can't fork the hash chain.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const log = useCallback((actor: string, action: string, detail?: string, patch?: Partial<CaseState>) => {
    queue.current = queue.current.then(async () => {
      const audit = await appendAudit(stateRef.current.audit, { actor, action, detail });
      const next = { ...stateRef.current, ...patch, audit };
      stateRef.current = next;
      setState(next);
      saveCaseState(id, next);
    });
    return queue.current;
  }, [id]);

  const updateReview = (patch: Partial<CaseState["review"]>) => {
    const next = { ...stateRef.current, review: { ...stateRef.current.review, ...patch } };
    stateRef.current = next;
    setState(next); saveCaseState(id, next);
  };

  const status = state.review.status;
  const firstIdx = a.drone.firstIndex;

  async function exportPdf() {
    await downloadCasePdf({
      caseId: cid, name: scenario.name, location: scenario.location_name, simulated: scenario.is_simulated, claimRef: state.claimRef,
      fingerprint, fingerprintKind, flightStart: points[0]!.t, flightEnd: points[points.length - 1]!.t,
      analysis: a, review: state.review, audit: state.audit, narrative,
    });
    await log("You", "Evidence report exported (PDF)", state.claimRef ? `Claim ${state.claimRef}` : undefined);
  }

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-6 pt-8 sm:px-8">
        <Link to="/evidence" hash="cases" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All cases
        </Link>
        {scenario.is_simulated && <div className="mt-5"><DemoBanner /></div>}

        {/* CASE HEADER */}
        <header className="mt-6 flex flex-col gap-5 border-b pb-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-subtle">
              <span className="text-foreground">{cid}</span>
              <span>Created {utc(scenario.created_at).slice(0, 16)} UTC</span>
              <span>Method {METHOD_VERSION}</span>
              <StatusBadge status={status} />
            </p>
            <h1 className="mt-3 text-[28px] leading-[34px] sm:text-[36px] sm:leading-[44px]">{scenario.name}</h1>
            <p className="mt-1 text-muted-foreground">{scenario.location_name ?? "Location not recorded"} · {utc(points[0]!.t).slice(0, 16)} UTC · {Math.round(a.durationS / 60)} min · {points.length.toLocaleString()} GPS readings</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.primary} onClick={exportPdf} disabled={!ready}><FileDown className="h-4 w-4" /> Download PDF</button>
            <button type="button" className={btn.secondary} onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>
              <Link2 className="h-4 w-4" /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </header>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-24 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-16">
          {/* FINDING */}
          <section aria-labelledby="finding-h">
            <Eyebrow>Finding</Eyebrow>
            <h2 id="finding-h" className="mt-3 text-[26px] leading-[33px] sm:text-[34px] sm:leading-[42px]">{a.v.title}</h2>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ConfidenceMeter level={a.v.confidence} />
              <span className="text-sm text-muted-foreground">{a.v.why}</span>
            </div>
            {status === "override" && state.review.override && (
              <div className="mt-6 rounded-xl border border-primary/40 bg-primary/[0.06] p-5">
                <p className="eyebrow">Reviewer's finding</p>
                <p className="mt-2 text-lg">{VERDICTS[state.review.override.key].title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Reason: {state.review.override.reason}</p>
                <p className="mt-2 text-xs text-subtle">The automated finding above is kept for the record.</p>
              </div>
            )}
            <Grid a={a} />
            <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
              <div><dt className="inline font-medium text-foreground">High: </dt><dd className="inline">both witnesses available and agree.</dd></div>
              <div><dt className="inline font-medium text-foreground">Medium: </dt><dd className="inline">one witness only, or they disagree in an explained way.</dd></div>
              <div><dt className="inline font-medium text-foreground">Low: </dt><dd className="inline">data too poor for a reliable finding.</dd></div>
            </dl>
          </section>

          {/* FOR / AGAINST */}
          <section aria-labelledby="fa-h">
            <Eyebrow>Evidence for and against</Eyebrow>
            <h2 id="fa-h" className="sr-only">Evidence for and against</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              <ForAgainst title="Points towards interference" rules={a.rules.filter((r) => r.result === "met")} tone="text-bad" />
              <ForAgainst title="Points away from interference" rules={a.rules.filter((r) => r.result === "not_met")} tone="text-good" />
              <ForAgainst title="Not assessable" rules={a.rules.filter((r) => r.result === "na")} tone="text-na" />
            </div>
          </section>

          {/* EVIDENCE TABLE */}
          <section aria-labelledby="ev-h">
            <Eyebrow>Evidence table</Eyebrow>
            <h2 id="ev-h" className="mt-3 text-2xl">Two independent witnesses</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-subtle">
                  <tr className="border-b"><th className="py-3 pr-4 font-medium">ID</th><th className="py-3 pr-4 font-medium">Evidence</th><th className="py-3 pr-4 font-medium">Observed</th><th className="py-3 pr-4 font-medium">Threshold</th><th className="py-3 font-medium">Result</th></tr>
                </thead>
                <tbody className="divide-y">
                  {a.rules.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-4 pr-4 font-mono">{r.id}</td>
                      <td className="py-4 pr-4">
                        <p>{r.label}</p>
                        <p className="mt-0.5 text-xs text-subtle">{r.source === "drone" ? "Drone flight log" : "Aircraft overhead · Stanford GPS Lab"}{r.index !== null ? ` · first at ${mmss(points, r.index)}` : ""}</p>
                      </td>
                      <td className="py-4 pr-4 font-mono text-xs text-muted-foreground">{r.observed}</td>
                      <td className="py-4 pr-4 font-mono text-xs text-muted-foreground">{r.threshold}</td>
                      <td className="py-4"><ResultBadge r={r.result} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* EXHIBITS */}
          <section aria-labelledby="ex-h" className="space-y-10">
            <div>
              <Eyebrow>Exhibit A</Eyebrow>
              <h2 id="ex-h" className="mt-3 text-2xl">Flight path</h2>
              <div className="mt-5 h-[300px] overflow-hidden rounded-xl border sm:h-[420px]">
                <ClientOnly fallback={<div className="h-full animate-pulse bg-card" />}>
                  <Suspense fallback={<div className="h-full animate-pulse bg-card" />}>
                    <FlightMap points={points} events={a.sky.events} firedIndex={firstIdx} />
                  </Suspense>
                </ClientOnly>
              </div>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <Dot c="bg-good" l="Accuracy < 3 m" /><Dot c="bg-warn" l="3–10 m" /><Dot c="bg-bad" l="> 10 m" />
                {a.sky.events.length > 0 && <span>Dashed circle: reported interference event</span>}
                <span className="text-subtle">Source: drone flight log{a.sky.events.length ? "; events from Stanford GPS Lab" : ""}.</span>
              </p>
            </div>
            <div>
              <Eyebrow>Exhibit B</Eyebrow>
              <h3 className="mt-3 text-2xl">GPS quality over time</h3>
              <SignalChart points={points} firstIdx={firstIdx} />
              <p className="mt-3 text-xs text-subtle">
                {firstIdx !== null ? `Drone evidence first fired at ${mmss(points, firstIdx)} into the flight (${utc(points[firstIdx]!.t).slice(11)}). ` : "No drone evidence fired. "}
                Shaded band: readings with accuracy worse than 10 m or a receiver alarm.{scenario.is_simulated ? " Simulated data." : ""}
              </p>
            </div>
          </section>

          {/* CHANGE + LIMITS */}
          <section className="grid gap-10 sm:grid-cols-2">
            <div>
              <Eyebrow>What would change this finding</Eyebrow>
              <ul className="mt-4 space-y-3 text-muted-foreground">{a.change.map((c) => <li key={c} className="border-t pt-3">{c}</li>)}</ul>
            </div>
            <div>
              <Eyebrow>Limitations for this case</Eyebrow>
              <ul className="mt-4 space-y-3 text-muted-foreground">{a.limits.map((c) => <li key={c} className="border-t pt-3">{c}</li>)}</ul>
            </div>
          </section>

          {/* NARRATIVE */}
          <Narrative
            caseUuid={id}
            claimRef={state.claimRef}
            onClaimRef={(v) => { const next = { ...stateRef.current, claimRef: v }; stateRef.current = next; setState(next); saveCaseState(id, next); }}
            narrative={narrative}
            onNarrative={async (t) => { setNarrative(t); await log("You", "Narrative drafted (language model)", "Labelled as machine-drafted in the report"); }}
          />
        </div>

        {/* RAIL */}
        <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
          <Fingerprint fingerprint={fingerprint} kind={fingerprintKind} hasOriginal={!!scenario.file_sha256} created={scenario.created_at} filename={scenario.source_filename}
            onVerified={(ok) => log("You", ok ? "File verified: fingerprint matches" : "File checked: fingerprint does NOT match")} />
          <Review a={a} state={state} ready={ready} onChange={updateReview} log={log} />
          <AuditTrail audit={state.audit} />
        </aside>
      </div>
    </Page>
  );
}

/* ---------- pieces ---------- */

function StatusBadge({ status }: { status: CaseState["review"]["status"] }) {
  const m = { draft: ["Draft", "border-na/40 text-na"], reviewed: ["Reviewed", "border-good/40 text-good"], override: ["Reviewed with override", "border-primary/50 text-primary"] } as const;
  const [l, c] = m[status];
  return <span className={`rounded-full border px-2 py-0.5 ${c}`}>{l}</span>;
}

function Grid({ a }: { a: Analysis }) {
  const unknown = a.sky.status === "unknown";
  return (
    <div className="mt-8 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-sm">
      <div />
      {(["yes", "no"] as const).map((s) => <div key={s} className={`pb-1 text-center font-mono text-[11px] ${unknown ? "text-subtle/60" : "text-subtle"}`}>Aircraft {s.toUpperCase()}</div>)}
      {(["yes", "no"] as const).map((d) => (
        <GridRow key={d} d={d} a={a} unknown={unknown} />
      ))}
    </div>
  );
}

function GridRow({ d, a, unknown }: { d: "yes" | "no"; a: Analysis; unknown: boolean }) {
  return (
    <>
      <div className="flex items-center pr-2 font-mono text-[11px] text-subtle">Drone {d.toUpperCase()}</div>
      {(["yes", "no"] as const).map((s) => {
        const k = `${d}-${s}` as VerdictKey;
        const on = !unknown && a.v.key === k;
        const rowOn = unknown && a.v.row === d;
        return (
          <div key={s} className={`rounded-lg border p-3 ${on ? "border-foreground/70 bg-foreground/[0.06]" : rowOn ? "border-dashed border-foreground/40" : "border-border/60"}`}>
            <p className={`text-xs leading-snug sm:text-[13px] ${on ? "font-medium" : rowOn ? "" : "text-subtle"}`}>{VERDICTS[k].title}</p>
            <p className="mt-1 text-[11px] text-subtle">{unknown ? "Medium confidence (capped: not enough aircraft data)" : `${VERDICTS[k].confidence} confidence`}</p>
          </div>
        );
      })}
    </>
  );
}

function ForAgainst({ title, rules, tone }: { title: string; rules: Rule[]; tone: string }) {
  return (
    <div className="border-t pt-4">
      <p className={`text-sm font-medium ${tone}`}>{title}</p>
      {rules.length ? (
        <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
          {rules.map((r) => <li key={r.id}><span className="font-mono text-foreground">{r.id}</span> {r.detail}</li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-subtle">None</p>}
    </div>
  );
}

function ResultBadge({ r }: { r: CheckResult }) {
  const m = {
    met: { l: "Met", c: "border-bad/40 text-bad", I: Check },
    not_met: { l: "Not met", c: "border-good/40 text-good", I: X },
    na: { l: "Not assessable", c: "border-na/40 text-na", I: Minus },
  }[r];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${m.c}`}><m.I className="h-3 w-3" aria-hidden="true" />{m.l}</span>;
}

function Dot({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-1.5 w-4 rounded ${c}`} />{l}</span>;
}

function SignalChart({ points, firstIdx }: { points: CasePoint[]; firstIdx: number | null }) {
  const t0 = new Date(points[0]!.t).getTime();
  const step = Math.max(1, Math.ceil(points.length / 1500));
  const data = points.filter((_, i) => i % step === 0 || i === firstIdx).map((p) => ({
    s: Math.round((new Date(p.t).getTime() - t0) / 1000),
    accuracy: p.accuracy_m === null ? null : Number(p.accuracy_m.toFixed(1)),
    satellites: p.satellites,
    bad: (p.accuracy_m ?? 0) > 10 || p.jamming_state === 3 || p.spoofing_state === 3,
  }));
  const badIdx = data.map((d, i) => (d.bad ? i : -1)).filter((i) => i >= 0);
  const band: [number, number] | null = badIdx.length ? [data[badIdx[0]!]!.s, data[badIdx[badIdx.length - 1]!]!.s] : null;
  const fired = firstIdx !== null ? Math.round((new Date(points[firstIdx]!.t).getTime() - t0) / 1000) : null;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="mt-5 h-72 rounded-xl border p-3 pt-5" role="img" aria-label={`Chart of GPS accuracy and satellites over ${fmt(data[data.length - 1]!.s)} of flight.`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="s" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmt} stroke="#868D98" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="a" stroke="#868D98" fontSize={11} unit=" m" tickLine={false} axisLine={false} width={48} />
          <YAxis yAxisId="s" orientation="right" stroke="#868D98" fontSize={11} tickLine={false} axisLine={false} width={28} />
          <Tooltip contentStyle={{ background: "#121418", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} labelFormatter={(s) => `t + ${fmt(Number(s))}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {band && <ReferenceArea yAxisId="a" x1={band[0]} x2={band[1]} fill="#E5574F" fillOpacity={0.08} stroke="none" />}
          {fired !== null && <ReferenceLine yAxisId="a" x={fired} stroke="#E5574F" strokeDasharray="4 3" label={{ value: "Evidence first fired", fill: "#E5574F", fontSize: 11, position: "insideTopLeft" }} />}
          <Area yAxisId="a" dataKey="accuracy" name="Accuracy (m)" stroke="#E0A84A" fill="#E0A84A" fillOpacity={0.08} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
          <Line yAxisId="s" dataKey="satellites" name="Satellites" stroke="#8FA8C8" strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Fingerprint({ fingerprint, kind, hasOriginal, created, filename, onVerified }: { fingerprint: string; kind: string; hasOriginal: boolean; created: string; filename: string | null; onVerified: (ok: boolean) => void }) {
  const [res, setRes] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function check(f: File) {
    setBusy(true);
    try { const h = await sha256Hex(await f.arrayBuffer()); const ok = h === fingerprint; setRes(ok); onVerified(ok); } finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="fp-h">
      <Eyebrow>Provenance</Eyebrow>
      <h2 id="fp-h" className="mt-3 text-lg">Fingerprint</h2>
      <p className="mt-1 text-xs text-subtle">{kind}</p>
      <div className="mt-3 rounded-lg border bg-card px-3 py-2"><HashField value={fingerprint} /></div>
      <dl className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
        {filename && <div className="flex justify-between gap-3"><dt className="text-subtle">File</dt><dd className="truncate">{filename}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-subtle">Recorded</dt><dd>{utc(created).slice(0, 16)} UTC</dd></div>
      </dl>
      {hasOriginal ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) check(f); }}
          className={`mt-4 rounded-lg border border-dashed p-4 text-center text-sm ${drag ? "border-foreground/60" : "border-foreground/20"}`}
        >
          <input ref={input} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f); e.target.value = ""; }} />
          <p className="text-muted-foreground">Check a copy of the file against this case.</p>
          <button type="button" onClick={() => input.current?.click()} className={`${btn.text} mt-2`} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choose or drop the file
          </button>
          {res !== null && (
            <p role="status" className={`mt-3 flex items-center justify-center gap-1.5 font-medium ${res ? "text-good" : "text-bad"}`}>
              {res ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}{res ? "Match: the file is unchanged" : "No match: this file differs from the original"}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-subtle">Demo case: there is no original file to check. Uploaded cases can be verified here.</p>
      )}
    </section>
  );
}

function Review({ a, state, ready, onChange, log }: { a: Analysis; state: CaseState; ready: boolean; onChange: (p: Partial<CaseState["review"]>) => void; log: (actor: string, action: string, detail?: string, patch?: Partial<CaseState>) => Promise<void> }) {
  const r = state.review;
  const [showOverride, setShowOverride] = useState(false);
  const [ovKey, setOvKey] = useState<VerdictKey>("no-no");
  const [reason, setReason] = useState("");
  const ids = a.rules.map((x) => x.id);
  const all = ids.every((i) => r.checked.includes(i));
  const actor = r.reviewer.trim() || "Reviewer";
  const locked = r.status !== "draft";

  return (
    <section aria-labelledby="rv-h">
      <Eyebrow>Reviewer sign-off</Eyebrow>
      <h2 id="rv-h" className="mt-3 text-lg">{locked ? (r.status === "override" ? "Reviewed with override" : "Reviewed") : "Awaiting review"}</h2>
      {locked ? (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>By <span className="text-foreground">{r.reviewer}</span>{r.role ? `, ${r.role}` : ""} on {(r.reviewedAt ?? "").replace("T", " ").slice(0, 16)} UTC.</p>
          <button type="button" className={btn.text} onClick={async () => { await log(actor, "Review reopened"); onChange({ status: "draft", override: null, reviewedAt: null }); }}>Reopen review</button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Reviewer name" placeholder="Your name" value={r.reviewer} onChange={(e) => onChange({ reviewer: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
            <input aria-label="Role" placeholder="Role" value={r.role} onChange={(e) => onChange({ role: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
          </div>
          <fieldset className="min-w-0">
            <legend className="text-xs text-subtle">Tick each evidence item once you've checked it</legend>
            <div className="mt-2 space-y-1">
              {a.rules.map((x) => (
                <label key={x.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-foreground/[0.03]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={r.checked.includes(x.id)} disabled={!ready}
                    onChange={async (e) => {
                      const checked = e.target.checked ? [...r.checked, x.id] : r.checked.filter((c) => c !== x.id);
                      onChange({ checked });
                      if (e.target.checked) await log(actor, `Evidence ${x.id} confirmed`);
                    }} />
                  <span className="font-mono text-xs">{x.id}</span><span className="min-w-0 flex-1 truncate text-muted-foreground" title={x.label}>{x.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" className={`${btn.primary} w-full`} disabled={!ready || !all || !r.reviewer.trim()}
            onClick={async () => { const at = new Date().toISOString(); await log(actor, "Marked as reviewed", `${a.v.title}`, { review: { ...r, status: "reviewed", reviewedAt: at } }); }}>
            Mark as reviewed
          </button>
          {(!all || !r.reviewer.trim()) && <p className="text-xs text-subtle">Enter your name and confirm all {ids.length} items to sign off.</p>}
          <div className="border-t pt-4">
            <button type="button" className={btn.text} onClick={() => setShowOverride((s) => !s)} aria-expanded={showOverride}>Override the finding</button>
            {showOverride && (
              <div className="mt-3 space-y-2">
                <select value={ovKey} onChange={(e) => setOvKey(e.target.value as VerdictKey)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm" aria-label="Reviewer's finding">
                  {(Object.keys(VERDICTS) as VerdictKey[]).map((k) => <option key={k} value={k}>{VERDICTS[k].title}</option>)}
                </select>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" rows={3} className="w-full rounded-lg border border-input bg-background p-3 text-sm" aria-label="Reason for override" />
                <button type="button" className={`${btn.secondary} w-full`} disabled={!ready || reason.trim().length < 5 || !r.reviewer.trim()}
                  onClick={async () => {
                    const at = new Date().toISOString();
                    await log(actor, "Finding overridden", `${VERDICTS[ovKey].title} — ${reason.trim()}`, { review: { ...r, status: "override", override: { key: ovKey, reason: reason.trim() }, reviewedAt: at } });
                    setShowOverride(false);
                  }}>
                  Save override and sign off
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-subtle">Prototype: sign-off is stored in this browser only.</p>
    </section>
  );
}

function AuditTrail({ audit }: { audit: CaseState["audit"] }) {
  const [broken, setBroken] = useState<number | null>(null);
  useEffect(() => { if (audit.length) verifyAudit(audit).then(setBroken); }, [audit]);
  return (
    <section aria-labelledby="au-h">
      <Eyebrow>Audit trail</Eyebrow>
      <h2 id="au-h" className="mt-3 flex items-center justify-between text-lg">
        Every action, in order
        {broken !== null && <span className={`font-mono text-[11px] ${broken === -1 ? "text-good" : "text-bad"}`}>{broken === -1 ? "chain intact" : `broken at #${broken + 1}`}</span>}
      </h2>
      <ol className="mt-4 space-y-0 border-l">
        {audit.map((e, i) => (
          <li key={e.hash} className="relative pb-4 pl-4">
            <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-foreground/50" aria-hidden="true" />
            <p className="text-sm">{e.action}</p>
            {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
            <p className="mt-0.5 font-mono text-[11px] text-subtle">#{i + 1} · {e.at.replace("T", " ").slice(0, 19)} UTC · {e.actor} · {e.hash.slice(0, 10)}</p>
          </li>
        ))}
        {!audit.length && <li className="pl-4 text-sm text-subtle">Loading…</li>}
      </ol>
      <p className="text-xs text-subtle">Each entry's hash covers the one before it, so editing any past entry breaks the chain.</p>
    </section>
  );
}

function Narrative({ caseUuid, claimRef, onClaimRef, narrative, onNarrative }: { caseUuid: string; claimRef: string; onClaimRef: (v: string) => void; narrative: string | null; onNarrative: (t: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setLoading(true); setErr(null);
    try { const r = await generateReport({ data: { id: caseUuid, claimRef: claimRef.trim() } }); await onNarrative(r.text); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); }
  }
  const body = useMemo(() => narrative?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [], [narrative]);
  return (
    <section aria-labelledby="nr-h">
      <Eyebrow>Evidence report</Eyebrow>
      <h2 id="nr-h" className="mt-3 text-2xl">Report for the claim file</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">The PDF always contains the structured evidence above. You can add a short narrative drafted by a language model from that evidence only; it is labelled as machine-drafted.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs text-muted-foreground">Claim reference (optional)</span>
          <input value={claimRef} onChange={(e) => onClaimRef(e.target.value.replace(/[^A-Za-z0-9 _./-]/g, "").slice(0, 40))} placeholder="CLM-2026-00123" className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm" />
        </label>
        <button type="button" onClick={run} disabled={loading} className={btn.secondary}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Drafting…" : narrative ? "Redraft narrative" : "Draft narrative"}
        </button>
      </div>
      {err && <p role="alert" className="mt-4 text-sm text-bad">{err} The PDF still works without a narrative.</p>}
      {narrative && (
        <article className="mt-6 space-y-1.5 rounded-xl border bg-card p-6 text-[15px] leading-relaxed">
          <p className="mb-3 font-mono text-[11px] text-warn">Machine-drafted from the evidence table. Check before relying on it.</p>
          {body.map((t, i) => t.startsWith("## ")
            ? <h3 key={i} className="pt-3 text-base font-medium">{t.slice(3)}</h3>
            : <p key={i} className={`text-muted-foreground ${t.startsWith("- ") ? "pl-3" : ""}`}>{t}</p>)}
        </article>
      )}
    </section>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Page>
      <div className="mx-auto max-w-xl px-6 py-28 text-center">
        <h1 className="text-[28px] leading-[34px]">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {action}
          <Link to="/evidence" hash="cases" className={btn.primary}>Back to cases</Link>
        </div>
      </div>
    </Page>
  );
}
