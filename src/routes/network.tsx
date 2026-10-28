import { createFileRoute, Link } from "@tanstack/react-router";
import { Ear, Lock, Waves, Building2, Ship, TrainFront, RadioTower } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, SectionHeading, btn } from "@/components/wm/ui";
import { Faq } from "@/components/wm/Faq";
import { PHOTOS } from "@/lib/photos";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/network")({
  head: () => ({ meta: seo({ title: "Ground sensor network", description: "Witnessmark's receive-only rooftop sensors listen for the low-power GPS jammers and spoofers that aircraft can't see. In development." }) }),
  component: Network,
});

const SIGNS = [
  ["Every strong satellite fades at once", "Jamming. A building or a lorry only blocks some satellites; noise in the GPS band hits all of them."],
  ["The receiver's gain shifts", "Extra energy in the band. The front end turns itself down to cope."],
  ["The receiver's own monitor speaks up", "Modern receivers carry a jamming and spoofing monitor. We record it, but never rely on it alone."],
  ["A fixed antenna appears to move", "Spoofing. A rooftop antenna can't travel 300 metres, so if it seems to, the signals are fake."],
  ["Signals are stronger than they should be", "Often spoofing: a nearby transmitter is louder than satellites 20,000 km away."],
];

const COMPARE: [string, string, string, string][] = [
  ["Hears small jammers near the ground?", "Rarely; built to find strong emitters", "Rarely; aircraft fly too high", "Yes; that's what it's for"],
  ["Where does it look?", "Wide areas, worldwide", "Along busy flight paths", "Only where a sensor is installed"],
  ["How often?", "When a satellite passes over", "When aircraft are overhead", "Every second, day and night"],
  ["What do you get?", "Mostly sold to defence and governments", "Maps of affected airspace", "Alerts and a record of each event with its evidence"],
];

const FAQ = [
  ["Is this legal?", "Yes. The sensors only receive, like any satnav. We never build, buy or test anything that transmits on GPS frequencies; doing so is illegal in the UK."],
  ["Where are the sensors?", "We don't publish exact sensor locations, for the privacy of the people who host them. Events are reported by area."],
  ["Is there live data yet?", "Not yet. The first sensor is being built now. Anything shown on this site before then is labelled as simulated."],
  ["How do you avoid false alarms?", "Each site first learns its own normal. An event needs at least two independent signs together for several seconds, and every event states its confidence. Thresholds are tuned against jamming exercises the CAA announces in advance."],
];

function Network() {
  return (
    <Page overlay>
      <PageIntro
        photo={PHOTOS.rooftop}
        eyebrow="Ground sensor network · in development"
        title="A witness at street level."
        lead="Aircraft fly too high to notice the small jammers that bring drones down. Witnessmark's rooftop receivers listen for them directly, learn what normal looks like at each site and record every interference event with its evidence."
      >
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/monitor" className={btn.primary}>Try site monitoring →</Link>
          <Link to="/method" className={btn.text}>Read the method →</Link>
        </div>
      </PageIntro>

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="Why it matters" title="The jammers that matter to drones are the ones aircraft miss." lead="The UK Civil Aviation Authority says lower-power jammers are now routinely used to protect major public events and mass gatherings, and that they can block a drone's return-to-home and geofencing. Aircraft at altitude rarely notice them. A receiver on a rooftop does." />
          <p className="mt-4 text-sm text-subtle">
            Source: <a className="underline underline-offset-4 hover:text-foreground" href="https://www.suasnews.com/2026/07/civil-aviation-authority-issues-guidance-as-counter-drone-technology-disrupts-uk-airspace/" target="_blank" rel="noreferrer">CAA guidance reported by sUAS News, July 2026</a>
          </p>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
            {[
              [Ear, "Listen only", "Receive-only receivers, legal to operate anywhere. Nothing is ever transmitted."],
              [Waves, "Multi-band", "Multi-band receivers keep listening when one band is hit, and see interference a single-band chip would miss."],
              [Lock, "Private by design", "Exact positions stay on the device. Exports and reports carry an area, never an address."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Ear;
              return (
                <li key={t as string} className="bg-background p-7">
                  <I className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-5 text-xl">{t as string}</h3>
                  <p className="mt-3 text-muted-foreground">{d as string}</p>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Where we fit" title="Three ways to watch GPS interference." lead="Satellites and aircraft see interference from above. They're good at wide areas and strong jammers, and weak at the street, which is where drones fly and where most sites sit." />
          <div className="mt-10 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-subtle">
                  <th scope="col" className="w-[28%] px-5 py-3 font-medium"><span className="sr-only">Question</span></th>
                  <th scope="col" className="px-5 py-3 font-medium">From space</th>
                  <th scope="col" className="px-5 py-3 font-medium">From aircraft</th>
                  <th scope="col" className="bg-foreground/[0.04] px-5 py-3 font-medium text-foreground">From the street (Witnessmark)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {COMPARE.map(([q, a, b, c]) => (
                  <tr key={q}>
                    <th scope="row" className="px-5 py-4 font-medium text-foreground">{q}</th>
                    <td className="px-5 py-4 text-muted-foreground">{a}</td>
                    <td className="px-5 py-4 text-muted-foreground">{b}</td>
                    <td className="bg-foreground/[0.04] px-5 py-4 text-foreground">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-subtle">The three views work best together. Witnessmark already combines aircraft reports with the drone's own log; ground sensors add the missing layer.</p>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading eyebrow="How a sensor decides" title="Independent signs, never just one." lead="Each sensor learns its site for the first half hour, then compares every second against that baseline. An event needs at least two independent signs together for five seconds." />
          <ol className="divide-y border-y">
            {SIGNS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2rem_1fr] gap-4 py-5">
                <span className="font-mono text-sm text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <div><p className="font-medium">{t}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="sites" className="scroll-mt-20 border-t py-24">
        <Container>
          <SectionHeading eyebrow="Site monitoring" title="Much of the UK runs on GPS time and position." lead="The same sensors matter wherever GPS is quietly relied on. A UK Space Agency study estimated that a seven-day loss of satellite navigation would cost the UK economy about £7.6 billion, most of it in emergency services, roads and shipping." />
          <p className="mt-4 text-sm text-subtle">
            Source: <a className="underline underline-offset-4 hover:text-foreground" href="https://www.gov.uk/government/publications/report-the-economic-impact-on-the-uk-of-a-disruption-to-gnss/the-economic-impact-on-the-uk-of-a-disruption-to-gnss-executive-summary" target="_blank" rel="noreferrer">The economic impact on the UK of a disruption to GNSS, UK Space Agency / London Economics (published 2023)</a>
          </p>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Ship, "Ports", "Cranes, pilots and vessel traffic depend on position."],
              [TrainFront, "Rail", "Train location and passenger information use GNSS."],
              [RadioTower, "Telecoms", "Mobile networks keep time from satellites."],
              [Building2, "Venues & cities", "Counter-drone systems at events affect everyone nearby."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Ship;
              return (
                <div key={t as string} className="rounded-xl border bg-card p-6">
                  <I className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <p className="mt-4 font-medium">{t as string}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{d as string}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 grid gap-8 border-t pt-8 md:grid-cols-2">
            <p className="max-w-xl text-muted-foreground">In November 2025 the government committed £13 million to a national programme to monitor GPS jamming and spoofing (<a className="underline underline-offset-4 hover:text-foreground" href="https://www.gov.uk/government/news/landmark-government-investment-to-safeguard-the-essential-signals-we-all-rely-on" target="_blank" rel="noreferrer">GOV.UK</a>). National monitoring shows the big picture. A sensor on your own roof tells you what is happening at your site, as it happens, with a record you can keep.</p>
            <div>
              <p className="font-medium">What a site gets</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>A small receive-only sensor on the roof</li>
                <li>An alert when jamming or spoofing is detected, with its evidence and confidence</li>
                <li>A record of every event, ready for incident reviews and resilience reports</li>
              </ul>
              <Link to="/monitor" className={`${btn.primary} mt-6`}>Try site monitoring</Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading eyebrow="FAQ" title="Straight answers." />
          <Faq items={FAQ} />
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="text-[28px] leading-[34px] sm:text-[36px] sm:leading-[44px]">See what a sensor catches.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">Upload a sensor log, or use one of the simulated samples, and watch the detector work.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/monitor" className={btn.primary}>Try site monitoring</Link>
            <Link to="/demo" hash="sites" className={btn.secondary}>Sample sensor logs</Link>
          </div>
        </Container>
      </section>
    </Page>
  );
}
