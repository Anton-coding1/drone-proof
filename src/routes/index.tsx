import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, BookOpen, Fingerprint, Database } from "lucide-react";
import heroImage from "@/assets/hero-drone-poster.jpg";
import { Page } from "@/components/wm/Page";
import { DecisionDemo } from "@/components/home/DecisionDemo";
import { Photo, PhotoCredit } from "@/components/wm/Photo";
import { btn } from "@/components/wm/ui";
import { PHOTOS, type Photo as PhotoT } from "@/lib/photos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seo({ title: "Witnessmark", description: "Independent intelligence on GPS jamming and spoofing for drones: a GO / CAUTION / NO-GO check before a drone flies, and tamper-evident evidence after an incident." }),
    links: [{ rel: "preload", as: "image", href: heroImage }],
  }),
  component: Home,
});

function Home() {
  return (
    <Page overlay>
      {/* The photograph is fixed: it stays still while the page moves over it. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <img src={heroImage} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover [filter:saturate(0.85)_brightness(0.92)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,10,0.55)_0%,rgba(8,9,10,0.1)_35%,rgba(8,9,10,0.5)_75%,rgba(8,9,10,0.85)_100%)]" />
      </div>

      {/* HERO */}
      <section aria-labelledby="hero-h" className="relative flex min-h-[100svh] items-end">
        <div className="mx-auto w-full max-w-6xl px-6 pb-[11vh] sm:px-8">
          <h1 id="hero-h" className="max-w-[13ch] text-[48px] font-medium leading-[50px] tracking-[-0.035em] text-white sm:text-[76px] sm:leading-[76px] lg:text-[96px] lg:leading-[92px]">
            Know when GPS can be trusted.
          </h1>
          <div className="mt-9 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-md text-[18px] leading-[28px] text-white/80">
              Independent intelligence on GPS jamming and spoofing for drones. A decision before a drone flies, and evidence after an incident.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/demo" className={btn.primary}>Try it with your data</Link>
              <Link to="/pre-flight/check" className={`${btn.secondary} border-white/35 bg-black/20 text-white backdrop-blur-sm hover:bg-black/35`}>Check a route</Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATEMENT — still over the photograph */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/75 to-background" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 pb-32 pt-24 sm:px-8 sm:pb-44 sm:pt-32">
          <p className="max-w-[24ch] text-[30px] font-medium leading-[38px] tracking-[-0.025em] text-white sm:text-[48px] sm:leading-[56px]">
            Drones navigate by GPS. GPS is easy to drown out.
          </p>
          <p className="mt-6 max-w-xl text-[18px] leading-[29px] text-white/75">
            Witnessmark measures that risk before a drone flies, and gives an independent account when one comes down. In July 2026 the UK Civil Aviation Authority warned of a sharp rise in jamming and told operators not to rely on GPS alone.{" "}
            <a className="whitespace-nowrap text-white/55 underline underline-offset-4 hover:text-white" href="https://www.suasnews.com/2026/07/civil-aviation-authority-issues-guidance-as-counter-drone-technology-disrupts-uk-airspace/" target="_blank" rel="noreferrer">Source</a>
          </p>
        </div>
      </section>

      <div className="relative bg-background">
        <DecisionDemo />

        {/* WHY NOW */}
        <section aria-labelledby="why-h" className="border-t py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6 sm:px-8">
            <p className="eyebrow">Why now</p>
            <h2 id="why-h" className="mt-3 max-w-2xl text-[32px] leading-[38px] sm:text-[44px] sm:leading-[50px]">Interference is rising just as drones go beyond the pilot's sight.</h2>
            <dl className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
              {WHY_NOW.map((w) => (
                <div key={w.figure} className="flex flex-col bg-background p-7 sm:p-8">
                  <dt className="text-[40px] font-medium leading-none tracking-[-0.03em] text-foreground sm:text-[52px]">{w.figure}</dt>
                  <dd className="mt-5 flex flex-1 flex-col">
                    <span className="text-[15px] leading-6 text-muted-foreground">{w.text}</span>
                    <a href={w.href} target="_blank" rel="noreferrer" className="mt-5 text-xs text-subtle underline-offset-4 hover:text-foreground hover:underline">{w.source} ↗</a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* THE PRODUCT */}
        <section aria-labelledby="products-h" className="border-t py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6 sm:px-8">
            <p className="eyebrow">The product</p>
            <h2 id="products-h" className="mt-3 max-w-2xl text-[32px] leading-[38px] sm:text-[44px] sm:leading-[50px]">Before the flight, and after it.</h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-7 text-muted-foreground">Witnessmark keeps one independent record of GPS interference and turns it into the decision someone has to make. We're currently collecting our own interference data. Today Witnessmark uses public aircraft reports and the files you upload; the demo samples are simulated. <Link to="/product" className="whitespace-nowrap text-foreground underline underline-offset-4">See how it fits together</Link></p>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              <ProductCard to="/pre-flight" photo={PHOTOS.london} when="Before the flight" name="Pre-flight check" line="GO, CAUTION or NO-GO for every section of a planned route, with reasons and a PDF for your safety case." />
              <ProductCard to="/evidence" photo={PHOTOS.drone} when="After an incident" name="Incident evidence" line="Upload a flight log. Two independent witnesses give a neutral, tamper-evident finding for the claim." />
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section aria-labelledby="trust-h" className="border-t py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 sm:px-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">Built to be trusted</p>
                <h2 id="trust-h" className="mt-3 max-w-xl text-[32px] leading-[38px] sm:text-[40px] sm:leading-[46px]">A witness is only useful if both sides believe it.</h2>
              </div>
              <Link to="/trust" className={btn.text}>Trust &amp; security →</Link>
            </div>
            <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(([Icon, t, d]) => (
                <li key={t} className="border-t pt-6">
                  <Icon className="h-5 w-5 text-signal" strokeWidth={1.5} aria-hidden="true" />
                  <p className="mt-5 font-medium">{t}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CLOSING */}
        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-24 sm:px-8 sm:py-32 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="max-w-[18ch] text-[32px] leading-[38px] sm:text-[44px] sm:leading-[50px]">Try it with your own data.</h2>
              <p className="mt-4 max-w-md text-muted-foreground">Every feature accepts a spreadsheet: a planned route or a drone flight log, as CSV or Excel. Use your own, or the samples provided.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/demo" className={btn.primary}>Try it</Link>
              <Link to="/pre-flight/check" className={btn.secondary}>Check a route</Link>
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}

const TRUST: [typeof ShieldCheck, string, string][] = [
  [ShieldCheck, "Independent", "Not a drone maker, an insurer or a defence contractor. The same checks run whoever asks."],
  [BookOpen, "Published method", "Every rule, threshold and limitation is public and versioned, so results can be challenged."],
  [Fingerprint, "Tamper-evident", "Uploads are fingerprinted on our server, and every action on a case is chained."],
  [Database, "Clear about its data", "Every result says which data it used, how much and how recent. Simulated data is always labelled."],
];

const WHY_NOW = [
  { figure: "July 2026", text: "The CAA warned of a sharp rise in jamming, and said lower-power jammers now routinely protect major events and can block a drone's return-to-home.", source: "CAA guidance, via sUAS News", href: "https://www.suasnews.com/2026/07/civil-aviation-authority-issues-guidance-as-counter-drone-technology-disrupts-uk-airspace/" },
  { figure: "£155m", text: "Government investment in navigation resilience, announced November 2025, including £13m for a national programme to monitor GPS jamming and spoofing.", source: "GOV.UK, November 2025", href: "https://www.gov.uk/government/news/landmark-government-investment-to-safeguard-the-essential-signals-we-all-rely-on" },
  { figure: "£7.6bn", text: "Estimated cost to the UK economy of losing satellite navigation for seven days, mostly in emergency services, roads and shipping.", source: "UK Space Agency, 2023", href: "https://www.gov.uk/government/publications/report-the-economic-impact-on-the-uk-of-a-disruption-to-gnss/the-economic-impact-on-the-uk-of-a-disruption-to-gnss-executive-summary" },
];

function ProductCard({ to, hash, photo, when, name, line }: { to: string; hash?: string; photo: PhotoT; when: string; name: string; line: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border">
      <Link to={to} {...(hash ? { hash } : {})} className="block" aria-label={`${name}: ${line}`}>
        <div className="relative aspect-[4/5]">
          <Photo photo={photo} className="absolute inset-0 h-full w-full transition-[filter] duration-500 [filter:brightness(0.8)] group-hover:[filter:brightness(0.95)]" sizes="(min-width: 768px) 560px, 100vw" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,10,0)_35%,rgba(8,9,10,0.9)_100%)]" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-7 sm:p-8">
            <p className="text-sm text-white/65">{when}</p>
            <p className="mt-2 text-[28px] font-medium leading-[34px] tracking-[-0.025em] text-white">{name}</p>
            <p className="mt-3 max-w-sm text-white/75">{line}</p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white">
              Learn more <span className="sr-only">about {name}</span> <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </p>
          </div>
        </div>
      </Link>
      <PhotoCredit photo={photo} className="absolute right-4 top-4" />
    </div>
  );
}
