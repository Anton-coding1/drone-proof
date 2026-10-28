import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plane, FileText, RadioTower, Route as RouteIcon, FileSearch, Siren, Database } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, SectionHeading, btn } from "@/components/wm/ui";
import { PHOTOS } from "@/lib/photos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/product")({
  head: () => ({ meta: seo({ title: "Product", description: "Witnessmark is one product: an independent record of GPS jamming and spoofing, used for pre-flight checks, incident evidence and site monitoring." }) }),
  component: Product,
});

const SOURCES = [
  { icon: Plane, name: "Aircraft reports", text: "GPS quality reported by aircraft overhead, via the Stanford GPS Laboratory.", status: "In use" },
  { icon: FileText, name: "Drone flight logs", text: "The drone's own receiver, uploaded by the operator or claimant and fingerprinted on arrival.", status: "In use" },
  { icon: RadioTower, name: "Ground sensors", text: "Our receive-only rooftop receivers, which hear the small jammers aircraft miss.", status: "In development" },
];

const FEATURES = [
  {
    icon: RouteIcon, name: "Pre-flight check", when: "Before the flight", status: "Prototype", to: "/pre-flight", hash: undefined,
    who: "Drone operators, especially those flying beyond the pilot's sight.",
    gets: "GO, CAUTION or NO-GO for every section of a route, with reasons, confidence and a PDF for the safety case.",
  },
  {
    icon: FileSearch, name: "Incident evidence", when: "After an incident", status: "Prototype", to: "/evidence", hash: undefined,
    who: "Insurers, brokers, loss adjusters and operators.",
    gets: "A neutral finding on whether GPS interference, the pilot or the hardware is the likely cause, with a fingerprinted case file.",
  },
  {
    icon: Siren, name: "Site monitoring", when: "All the time", status: "Prototype", to: "/monitor", hash: undefined,
    who: "Ports, airports, rail, telecoms and venues that rely on GPS.",
    gets: "An alert when GPS at the site is jammed or spoofed, and a record of every event for incident reviews.",
  },
];

function StatusTag({ s }: { s: string }) {
  const cls = s === "In use" ? "border-good/40 text-good" : s === "Prototype" ? "border-signal/40 text-signal" : "border-warn/40 text-warn";
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${cls}`}>{s}</span>;
}

function Product() {
  return (
    <Page overlay>
      <PageIntro
        photo={PHOTOS.cityRoof}
        eyebrow="The product"
        title="One product for GPS interference."
        lead="Witnessmark keeps an independent record of GPS jamming and spoofing, built from aircraft reports, drone logs and our own ground sensors. It turns that record into the decision each person needs: whether to fly, what caused an incident, or whether a site is under attack."
      >
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/pre-flight/check" className={btn.primary}>Try a pre-flight check →</Link>
          <Link to="/demo" className={btn.text}>Try it with your data →</Link>
        </div>
      </PageIntro>

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="How it fits together" title="Three sources. One record. Three jobs." lead="Every feature reads the same record, so a route check, a claim and a site alert never tell different stories." />
          <div className="mt-14 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_auto_0.8fr_auto_1fr]">
            <div>
              <p className="eyebrow">Sources</p>
              <ul className="mt-4 space-y-3">
                {SOURCES.map((s) => (
                  <li key={s.name} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 font-medium"><s.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />{s.name}</p>
                      <StatusTag s={s.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <Arrow />
            <div className="flex flex-col">
              <p className="eyebrow">The record</p>
              <div className="mt-4 flex flex-1 flex-col justify-center rounded-xl border-2 border-signal/60 bg-signal/[0.06] p-6">
                <Database className="h-6 w-6 text-signal" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-4 text-xl font-medium">The Witnessmark record</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Where and when GPS was degraded, jammed or spoofed, with the evidence for each reading. Judged by fixed, published rules.</p>
              </div>
            </div>
            <Arrow />
            <div>
              <p className="eyebrow">Features</p>
              <ul className="mt-4 space-y-3">
                {FEATURES.map((f) => (
                  <li key={f.name}>
                    <Link to={f.to} {...(f.hash ? { hash: f.hash } : {})} className="group block rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 font-medium"><f.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} aria-hidden="true" />{f.name}</p>
                        <StatusTag s={f.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.when}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Features" title="What each feature does." />
          <div className="mt-10 divide-y border-y">
            {FEATURES.map((f) => (
              <div key={f.name} className="grid gap-4 py-8 md:grid-cols-[1fr_1.2fr_1.2fr_auto] md:gap-8">
                <div>
                  <p className="text-sm text-subtle">{f.when}</p>
                  <p className="mt-1 text-xl font-medium">{f.name}</p>
                  <div className="mt-3"><StatusTag s={f.status} /></div>
                </div>
                <div><p className="text-xs text-subtle">For</p><p className="mt-1 text-muted-foreground">{f.who}</p></div>
                <div><p className="text-xs text-subtle">You get</p><p className="mt-1 text-muted-foreground">{f.gets}</p></div>
                <Link to={f.to} {...(f.hash ? { hash: f.hash } : {})} className={`${btn.text} self-start`}>Learn more <span className="sr-only">about {f.name}</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-12 md:grid-cols-2">
          <SectionHeading eyebrow="In every feature" title="The same rules, wherever you use it." />
          <ul className="space-y-4 text-muted-foreground">
            <li><span className="text-foreground">Reasons, confidence and limits</span> on every result, never just a score.</li>
            <li><span className="text-foreground">A published, versioned method</span>, so anyone can follow and challenge the reasoning. <Link to="/method" className="text-foreground underline underline-offset-4">Read it</Link></li>
            <li><span className="text-foreground">Fingerprints and an audit trail</span>, so records can be checked later.</li>
            <li><span className="text-foreground">Receive-only sensors and private locations.</span> We never transmit, and never publish where a sensor is.</li>
          </ul>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="text-[28px] leading-[34px] sm:text-[36px] sm:leading-[44px]">Try it with your own data.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">Every feature accepts a file. Use your own, or the samples provided.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/demo" className={btn.primary}>Try it</Link>
            <Link to="/pre-flight/check" className={btn.secondary}>Check a route</Link>
          </div>
        </Container>
      </section>
    </Page>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center py-1 text-subtle lg:pt-10" aria-hidden="true">
      <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
    </div>
  );
}
