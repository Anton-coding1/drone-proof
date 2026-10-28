import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowRight, Satellite, Plane, CalendarDays, Cpu, RadioTower, Sun } from "lucide-react";
import { THRESHOLDS, pct, type ConsequenceClass } from "@/lib/routeRisk";
import { StatusPill } from "@/components/wm/ui";
import { DEMO_ROUTE, DEMO_WEMBLEY, SCENARIOS, runDemo, type ScenarioId } from "@/components/home/demoData";

const DemoMap = lazy(() => import("@/components/home/DemoMap"));

type Level = "normal" | "elevated" | "high";
const DOT: Record<Level, string> = { normal: "bg-good", elevated: "bg-warn", high: "bg-bad" };
const WORD: Record<Level, string> = { normal: "Normal", elevated: "Raised", high: "High" };

/** Log scale from 0.1% to 100% for the chance meter. */
const pos = (p: number) => Math.min(0.98, Math.max(0.02, (Math.log10(Math.max(p, 0.001)) + 3) / 3));

export function DecisionDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("match");
  const [equipped, setEquipped] = useState(false);
  const result = useMemo(() => runDemo(scenario, equipped), [scenario, equipped]);

  const worstClass = result.sections.reduce<ConsequenceClass>((w, s) => (s.consequence > w ? s.consequence : w), "C1");
  const t = THRESHOLDS[worstClass];
  const worst = result.sections[result.worstIndex] ?? result.sections[0]!;
  const share = worst.adsb.n ? worst.adsb.k / worst.adsb.n : 0;
  const venueKm = Math.min(...DEMO_ROUTE.map((p) => Math.hypot((p[0] - DEMO_WEMBLEY.lat) * 111.2, (p[1] - DEMO_WEMBLEY.lon) * 69.2)));
  const note = SCENARIOS.find((s) => s.id === scenario)!.note;

  const signals: { icon: typeof Satellite; name: string; state: string; detail: string; level: Level }[] = [
    {
      icon: Satellite, name: "Space weather",
      state: scenario === "storm" ? "Severe storm (G4)" : "Quiet",
      detail: scenario === "storm" ? "Adds roughly a 10% chance of degraded GPS for every receiver." : "NOAA forecast adds nothing today.",
      level: scenario === "storm" ? "high" : "normal",
    },
    {
      icon: Plane, name: "Aircraft overhead",
      state: share > 0 ? `${Math.round(share * 100)}% report degraded GPS` : "All healthy",
      detail: scenario === "military" ? `${worst.adsb.n} reports near the route this month, plus a jamming event reported today.` : `${worst.adsb.n} reports near the route this month. They can miss small jammers near the ground.`,
      level: share > 0.2 ? "high" : share > 0 ? "elevated" : "normal",
    },
    {
      icon: CalendarDays, name: "Events near the route",
      state: scenario === "match" ? "Match at Wembley" : "None",
      detail: scenario === "match" ? `${venueKm < 1 ? "Under 1" : venueKm.toFixed(1)} km from the route. Counter-drone systems are common at big events.` : "No large events during the flight.",
      level: scenario === "match" ? "elevated" : "normal",
    },
    {
      icon: Cpu, name: "Your drone",
      state: equipped ? "Has a GPS fallback" : "No GPS fallback",
      detail: equipped ? "Multi-band receiver, failsafe and optical-flow fallback." : "Single-band receiver with no fallback.",
      level: equipped ? "normal" : "elevated",
    },
  ];

  const summary =
    result.routeLevelNote ? `No single stretch is over the limit, but across the whole ${result.totalKm.toFixed(1)} km the chance adds up to ${pct(result.pRoute)}. Fly with a pilot ready to take over, or use a better-equipped drone.`
    : result.decision === "go" ? "Every part of the route is comfortably inside the limit for the ground below."
    : result.decision === "caution" ? "Close to the limit. Fly only with a pilot ready to take over, or choose a better-equipped drone."
    : "Too likely to lose trustworthy GPS over people. Re-plan the route or wait.";

  return (
    <section aria-labelledby="demo-h" className="border-t bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="max-w-2xl">
          <p className="eyebrow">Pre-flight check · try it</p>
          <h2 id="demo-h" className="mt-3 text-[32px] leading-[38px] sm:text-[44px] sm:leading-[50px]">Watch a decision being made.</h2>
          <p className="mt-4 text-[17px] leading-7 text-muted-foreground">A 3.2 km medical delivery to Northwick Park Hospital, passing Wembley Stadium. Pick the conditions and the drone; the real method decides.</p>
        </div>

        {/* Controls */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Segmented label="Conditions" value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))} />
          <Segmented label="Drone" value={equipped ? "eq" : "basic"} onChange={(v) => setEquipped(v === "eq")} options={[{ value: "basic", label: "Basic drone" }, { value: "eq", label: "Well-equipped drone" }]} />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border bg-card lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          {/* Map */}
          <div className="relative isolate h-[340px] border-b sm:h-[440px] lg:h-auto lg:min-h-[580px] lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 z-0">
              <ClientOnly fallback={<div className="h-full bg-muted" />}>
                <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
                  <DemoMap result={result} eventActive={scenario === "match"} />
                </Suspense>
              </ClientOnly>
            </div>
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2">
              {scenario === "military" ? (
                <MapChip icon={RadioTower} tone="bad">Jamming trial reported 27 km south-west</MapChip>
              ) : scenario === "storm" ? (
                <MapChip icon={Sun} tone="bad">G4 storm forecast · affects every receiver</MapChip>
              ) : <span />}
              <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] text-white/70 backdrop-blur">Illustrative conditions</span>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex gap-3 rounded-md bg-black/65 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur">
              {(["go", "caution", "nogo"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-4 rounded-full ${k === "go" ? "bg-good" : k === "caution" ? "bg-warn" : "bg-bad"}`} aria-hidden="true" />
                  {k === "go" ? "GO" : k === "caution" ? "Caution" : "No-go"}
                </span>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div className="flex flex-col p-6 sm:p-8" aria-live="polite">
            <p className="text-sm text-muted-foreground">Decision for this flight</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusPill status={result.decision} size="lg" />
              <span className="text-sm text-subtle">{result.confidence} confidence</span>
            </div>
            <p className="mt-4 text-[15px] leading-6 text-foreground">{summary}</p>

            <Meter p={result.pRoute} go={t.go} nogo={t.nogo} />
            <p className="mt-2 text-xs leading-5 text-subtle">Limits for {t.label.toLowerCase()} ground, the most sensitive the route crosses.</p>

            <ul className="mt-7 divide-y border-y">
              {signals.map((s) => (
                <li key={s.name} className="flex gap-3 py-3.5">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" strokeWidth={1.6} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{s.name}</p>
                      <p className="flex shrink-0 items-center gap-1.5 text-sm text-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[s.level]}`} aria-hidden="true" />
                        <span className="sr-only">{WORD[s.level]}: </span>{s.state}
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-subtle">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 text-sm">
              <Link to="/pre-flight/check" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline underline-offset-4">Check your own route <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/method" hash="pre-flight" className="text-muted-foreground hover:text-foreground">How it's calculated</Link>
            </div>
          </div>
        </div>
        <p className="mt-4 min-h-10 max-w-3xl text-sm leading-6 text-muted-foreground">{note}</p>
      </div>
    </section>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 sm:flex">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm transition-colors sm:px-4 ${on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MapChip({ icon: Icon, tone, children }: { icon: typeof Sun; tone: "bad" | "warn"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border bg-black/70 px-2.5 py-1 text-xs backdrop-blur ${tone === "bad" ? "border-bad/50 text-[#F39A93]" : "border-warn/50 text-warn"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
    </span>
  );
}

function Meter({ p, go, nogo }: { p: number; go: number; nogo: number }) {
  const a = pos(go), b = pos(nogo), x = pos(p);
  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">Chance of losing trustworthy GPS</p>
        <p className="font-mono text-lg text-foreground">{pct(p)}</p>
      </div>
      <div className="relative mt-3 h-2" role="img" aria-label={`${pct(p)}. GO below ${pct(go)}, NO-GO from ${pct(nogo)}.`}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span className="h-full bg-good/45" style={{ width: `${a * 100}%` }} />
          <span className="h-full bg-warn/45" style={{ width: `${(b - a) * 100}%` }} />
          <span className="h-full flex-1 bg-bad/45" />
        </div>
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow transition-[left] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: `${x * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-subtle" aria-hidden="true">
        <span className="absolute -translate-x-1/2" style={{ left: `${a * 100}%` }}>{pct(go)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${b * 100}%` }}>{pct(nogo)}</span>
      </div>
    </div>
  );
}
