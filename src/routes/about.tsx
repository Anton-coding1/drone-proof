import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose, btn } from "@/components/wm/ui";
import { seo } from "@/lib/seo";
import { PHOTOS } from "@/lib/photos";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: seo({ title: "About", description: "Witnessmark is an early-stage start-up founded by engineering students in London, building independent intelligence on GPS jamming and spoofing for drones." }) }),
  component: About,
});

function About() {
  return (
    <Page overlay>
      <PageIntro photo={PHOTOS.cityRoof} eyebrow="About" title="A neutral witness for the signals machines rely on." lead="Witnessmark is an early-stage start-up founded by engineering students at Imperial College London. We're building independent intelligence on GPS jamming and spoofing for drones." />
      <Container narrow className="py-16">
        <Prose>
          <h2>Why we started</h2>
          <p>Drones increasingly fly where no pilot can see them, and they depend on GPS to know where they are. Meanwhile GPS jamming is rising, including from the counter-drone systems now used to protect public events. When a drone comes down, the cause decides the insurance claim, and today nobody can answer it quickly, consistently and neutrally.</p>
          <p>A surveyor's <em>witness mark</em> is a fixed reference that lets anyone check a position later. That's what we want to be for drones: an independent reference that both sides can trust, before the flight and after it.</p>
          <h2>What we're building</h2>
          <ul>
            <li><strong>Pre-flight check</strong>: a GO / CAUTION / NO-GO interference check for planned routes.</li>
            <li><strong>Incident evidence</strong>: independent, tamper-evident evidence of GPS interference for drone claims.</li>
          </ul>
          <h2>Where we're going</h2>
          <p>Drones are starting to fly where no pilot can see them, and every loss raises the question of cause. We're starting with the two decisions that matter most: whether to fly, and what happened. We're currently collecting our own interference data to make both more accurate.</p>
          <h2>Where we are</h2>
          <p>We're a two-person founding team with a working prototype, a published method and no paying customers yet. This version of the site is a demo: every feature can be tried with your own files or with simulated samples.</p>
          <p>Witnessmark is independent and is not endorsed by Imperial College London or by any data provider named on this site.</p>
        </Prose>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/demo" className={btn.primary}>Try the demo</Link>
          <Link to="/product" className={btn.secondary}>How it fits together</Link>
        </div>
      </Container>
    </Page>
  );
}
