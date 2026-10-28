import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, SectionHeading, StatusPill, btn } from "@/components/wm/ui";
import { THRESHOLDS, type ConsequenceClass } from "@/lib/routeRisk";
import { seo } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";

export const Route = createFileRoute("/pre-flight/")({
  head: () => ({ meta: seo({ title: "Pre-flight check", description: "GPS weather for drone routes: GO / CAUTION / NO-GO for GNSS interference on every section, with confidence, reasons and a PDF for your safety case." }) }),
  component: RoutesPage,
});

const INPUTS = [
  { name: "Aircraft GPS-quality reports", what: "Share of aircraft near each section reporting degraded navigation integrity over the last 30 days, and reported jamming or spoofing events within 50 km.", status: "In use", note: "Stanford GPS Laboratory data" },
  { name: "Your drone", what: "Receiver type, failsafes, non-GNSS fallback, RTK dependence and how long it can hold position without GNSS.", status: "You declare", note: "Changes the outcome as much as the jammer does" },
  { name: "Events near the route", what: "Stadium matches, state events and large gatherings, where counter-drone jamming is most likely.", status: "You declare", note: "Venue locations built in; calendars next" },
  { name: "Space weather", what: "Geomagnetic storm forecast that can degrade GNSS for everyone.", status: "Live", note: "NOAA Space Weather Prediction Center" },
  { name: "Ground consequence", what: "How many people are under each section, which sets how cautious the thresholds are.", status: "Approximate", note: "London model now; census grids next" },
  { name: "Our own interference data", what: "Interference data we collect ourselves, to sit alongside the public aircraft reports.", status: "In development", note: "Being collected now" },
];

function RoutesPage() {
  return (
    <Page overlay>
      <PageIntro
        photo={PHOTOS.london}
        eyebrow="Witnessmark · pre-flight check"
        title="GPS weather for your route."
        lead="Draw a route and describe your drone. Witnessmark checks every section for GPS interference and tells you GO, CAUTION or NO-GO, with the reasons, the confidence and a PDF for your safety case."
      >
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/pre-flight/check" className={btn.primary}>Check a route →</Link>
          <Link to="/method" hash="pre-flight" className={btn.text}>Read the method →</Link>
        </div>
      </PageIntro>

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="The formula" title="Three questions for every section." lead="A route is only as safe as its weakest section, so each one is scored on its own." />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
            {[
              ["01", "How likely is interference here?", "A probability built from aircraft reports, reported events, nearby events and space weather. It starts from a base rate for the area and updates with each clue."],
              ["02", "How vulnerable is this drone?", "A drone with multi-band GNSS, a configured failsafe and optical-flow fallback copes far better than a GNSS-only drone flying an RTK mission."],
              ["03", "How bad would a failure be?", "Over a controlled field, a higher chance is tolerable. Over a crowd, it isn't. The ground sets the threshold."],
            ].map(([n, t, d]) => (
              <li key={n} className="bg-background p-7">
                <p className="font-mono text-sm text-subtle">{n}</p>
                <h3 className="mt-4 text-xl">{t}</h3>
                <p className="mt-3 text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl rounded-xl border bg-card px-6 py-5 font-mono text-sm leading-7 text-muted-foreground">
            chance of interference × drone vulnerability = chance of losing trustworthy navigation → compared with the threshold for the ground below → <span className="text-good">GO</span> · <span className="text-warn">CAUTION</span> · <span className="text-bad">NO-GO</span>
          </p>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Thresholds" title="Published, not hidden." lead="These are the cut-offs the check uses today. They are provisional and will be calibrated on real flights." />
          <div className="mt-10 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-subtle">
                <tr className="border-b"><th className="px-5 py-3 font-medium">Ground</th><th className="px-5 py-3 font-medium">Density</th><th className="px-5 py-3 font-medium"><StatusPill status="go" size="sm" /></th><th className="px-5 py-3 font-medium"><StatusPill status="caution" size="sm" /></th><th className="px-5 py-3 font-medium"><StatusPill status="nogo" size="sm" /></th></tr>
              </thead>
              <tbody className="divide-y font-mono">
                {(Object.keys(THRESHOLDS) as ConsequenceClass[]).map((c) => {
                  const t = THRESHOLDS[c];
                  return (
                    <tr key={c}>
                      <td className="px-5 py-3.5 font-sans"><span className="font-medium">{c}</span> <span className="text-muted-foreground">· {t.label}</span></td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t.density}</td>
                      <td className="px-5 py-3.5">&lt; {t.go * 100}%</td>
                      <td className="px-5 py-3.5">{t.go * 100}–{t.nogo * 100}%</td>
                      <td className="px-5 py-3.5">≥ {t.nogo * 100}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-8 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
            <li className="border-t pt-4"><span className="text-foreground">Hard stops come first.</span> A notified jamming area, restricted airspace without permission or bad weather makes the route NO-GO, whatever the numbers say.</li>
            <li className="border-t pt-4"><span className="text-foreground">Thin data is never GO over people.</span> In populated areas, a Low-confidence section is shown as CAUTION — data-limited.</li>
            <li className="border-t pt-4"><span className="text-foreground">Insufficient data is its own state.</span> Sections without enough aircraft reports are drawn dashed, and say so.</li>
          </ul>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Inputs" title="What the check looks at — and what it can't yet." />
          <div className="mt-10 divide-y border-y">
            {INPUTS.map((i) => (
              <div key={i.name} className="grid gap-2 py-6 md:grid-cols-[1fr_2fr_auto] md:gap-8">
                <p className="font-medium">{i.name}</p>
                <p className="text-muted-foreground">{i.what} <span className="text-subtle">{i.note}.</span></p>
                <p><span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] ${i.status === "In use" || i.status === "Live" ? "border-good/40 text-good" : i.status === "In development" ? "border-na/40 text-na" : "border-warn/40 text-warn"}`}>{i.status}</span></p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-12 md:grid-cols-2">
          <SectionHeading eyebrow="Safety case" title="Built to sit inside your operational authorisation." />
          <div className="space-y-4 text-muted-foreground">
            <p>Under UK SORA, external services and environmental conditions are part of every application. A versioned, documented GNSS-interference check — with its inputs, thresholds, confidence and an exported record — is designed to support that evidence.</p>
            <p>Every PDF carries the method version, the data timestamp, your drone profile and a SHA-256 fingerprint of the full assessment, so you can show later exactly what you checked before flying.</p>
            <p className="text-subtle">It does not replace your safety case, CAA approval or the remote pilot's judgement.</p>
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="text-[28px] leading-[34px] sm:text-[36px] sm:leading-[44px]">Try it on your own route.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">Draw a route, upload your own, or use one of the sample route files.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/pre-flight/check" className={btn.primary}>Check a route →</Link>
            <Link to="/demo" hash="pre-flight" className={btn.secondary}>Sample routes</Link>
          </div>
        </Container>
      </section>
    </Page>
  );
}
