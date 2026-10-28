import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, RadioTower, Fingerprint, FileCheck2, ListChecks, ScrollText } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, SectionHeading, btn } from "@/components/wm/ui";
import { UploadBox } from "@/components/UploadBox";
import { CasesList } from "@/components/evidence/CasesList";
import { Faq } from "@/components/wm/Faq";
import { VERDICTS, type VerdictKey } from "@/lib/evidence";
import { seo } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";

export const Route = createFileRoute("/evidence")({
  head: () => ({ meta: seo({ title: "Incident evidence", description: "Independent, tamper-evident evidence of GPS interference for drone insurance claims. Upload a flight log; two independent witnesses give a finding with a stated confidence." }) }),
  component: Evidence,
});

const AUDIENCES = [
  ["Insurers & claims handlers", "Decide cause faster and the same way every time, with confidence and limits stated on the report."],
  ["Brokers", "Give clients a neutral first look at a loss before it becomes a dispute."],
  ["Drone operators", "Show a loss was consistent with interference, not pilot error, using a witness neither side controls."],
  ["Loss adjusters", "Every check, threshold and data source is visible, so the reasoning can be followed and challenged."],
];

const FAQ = [
  ["Is this legal proof?", "No. Witnessmark is decision support. It states what the evidence is consistent with, how confident the method is and what it cannot see. A reviewer signs off every report."],
  ["What flight logs do you accept?", "A CSV with time, position, altitude, satellites, accuracy and fix type, plus the receiver's jamming and spoofing fields if available. PX4 logs convert directly; DJI logs need a decrypted export."],
  ["What if there were no aircraft overhead?", "The second witness is marked \"not determinable\", the finding uses the drone log alone and confidence is capped at Medium. The report says so."],
  ["Can the result be tampered with?", "The original file is fingerprinted with SHA-256 on arrival. Anyone can re-check a copy of the file against the case, and every action on the case is recorded in a hash-chained audit trail."],
  ["Where does the aircraft data come from?", "GPS-quality reports broadcast by aircraft (ADS-B), processed by the Stanford GPS Laboratory and used under its non-commercial licence (CC BY-NC 4.0). We will hold a commercial licence before charging for the service."],
  ["Is my data used for training?", "We don't use flight logs to train models. If you ask for a drafted narrative, a summary of the evidence (not the raw log) is sent to an AI provider to write it. This is a prototype, so please don't upload confidential logs yet."],
];

function Evidence() {
  return (
    <Page overlay>
      <PageIntro
        photo={PHOTOS.drone}
        eyebrow="Witnessmark · incident evidence"
        title="Two witnesses. One clear finding."
        lead="Upload a drone flight log. Witnessmark checks it against aircraft overhead and gives a neutral, tamper-evident finding on whether GPS interference, the pilot or the hardware is the likely cause."
      >
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#upload" className={btn.primary}>Analyse a flight log →</a>
          <a href="#cases" className={btn.text}>See a sample case →</a>
        </div>
      </PageIntro>

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="How it works" title="Built like a case file, not a black box." />
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              [Fingerprint, "01", "Upload the flight log", "The file is fingerprinted with SHA-256 the moment it arrives, so any later copy can be checked against it."],
              [ListChecks, "02", "Compare two witnesses", "The drone's own GPS receiver, and GPS quality reported by aircraft overhead at the same place and time."],
              [FileCheck2, "03", "Get a finding", "A plain-English finding, a confidence level, the evidence for and against, a PDF report and reviewer sign-off."],
            ].map(([Icon, n, t, d]) => {
              const I = Icon as typeof Plane;
              return (
                <li key={n as string} className="border-t pt-6">
                  <div className="flex items-center justify-between"><I className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" /><span className="font-mono text-sm text-subtle">{n as string}</span></div>
                  <h3 className="mt-6 text-xl">{t as string}</h3>
                  <p className="mt-3 text-muted-foreground">{d as string}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="The witnesses" title="Why two sources beat a map." lead="Interference maps show where aircraft had trouble. They miss the small, ground-level jammers that actually bring drones down. Witnessmark asks both witnesses." />
          </div>
          <div className="divide-y border-y">
            <div className="py-6">
              <p className="flex items-center gap-2 font-medium"><Plane className="h-4 w-4 text-primary" aria-hidden="true" /> Witness 1 · the drone's GPS receiver</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><span className="font-mono text-foreground">E1</span> Receiver reported jamming or spoofing (state = 3)</li>
                <li><span className="font-mono text-foreground">E2</span> Accuracy collapses from &lt; 3 m to &gt; 10 m within 10 s as satellites drop by 5+</li>
                <li><span className="font-mono text-foreground">E3</span> A position jump faster than 30 m/s</li>
              </ul>
            </div>
            <div className="py-6">
              <p className="flex items-center gap-2 font-medium"><RadioTower className="h-4 w-4 text-primary" aria-hidden="true" /> Witness 2 · aircraft overhead</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><span className="font-mono text-foreground">S1</span> A reported jamming or spoofing event within 50 km overlaps the flight</li>
                <li><span className="font-mono text-foreground">S2</span> More than 20% of aircraft overhead reported degraded GPS (needs 5+ aircraft)</li>
              </ul>
            </div>
            <div className="py-6">
              <p className="flex items-center gap-2 font-medium text-muted-foreground"><RadioTower className="h-4 w-4" aria-hidden="true" /> Coming next · a witness at street level</p>
              <p className="mt-3 text-sm text-muted-foreground">Witnessmark's receive-only ground sensors will add a third, independent witness near the ground, where aircraft can't hear small jammers. <Link to="/network" className="text-foreground underline underline-offset-4">How they work</Link></p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Findings" title="Four possible findings, each with a confidence level." lead="If the aircraft witness can't be assessed, only the drone row is used and confidence is capped at Medium." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {(Object.keys(VERDICTS) as VerdictKey[]).map((k) => (
              <div key={k} className="bg-background p-6">
                <p className="font-mono text-xs text-subtle">Drone {k.startsWith("yes") ? "YES" : "NO"} · Aircraft {k.endsWith("yes") ? "YES" : "NO"}</p>
                <p className="mt-3 text-lg leading-snug">{VERDICTS[k].title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{VERDICTS[k].confidence} confidence</p>
              </div>
            ))}
          </div>
          <p className="mt-6"><Link to="/method" className={btn.text}><ScrollText className="h-4 w-4" /> Read the full method (v0.4) →</Link></p>
        </Container>
      </section>

      <section id="cases" className="scroll-mt-20 border-t py-24">
        <Container>
          <SectionHeading eyebrow="Try it" title="Open a sample case." lead="Each sample is a complete case file: finding, evidence table, exhibits, fingerprint, reviewer sign-off and audit trail." />
          <div className="mt-10"><CasesList /></div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container narrow>
          <UploadBox />
        </Container>
      </section>

      <section className="border-t py-24">
        <Container>
          <SectionHeading eyebrow="Who it's for" title="Neutral by design." lead="The same checks run whoever uploads the log." />
          <div className="mt-10 divide-y border-y">
            {AUDIENCES.map(([t, d]) => (
              <div key={t} className="grid gap-2 py-6 md:grid-cols-[1fr_2fr]"><p className="font-medium">{t}</p><p className="text-muted-foreground">{d}</p></div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t py-24">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading eyebrow="FAQ" title="Straight answers." />
          <Faq items={FAQ} />
        </Container>
      </section>
    </Page>
  );
}
