import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo, PhotoCredit } from "@/components/site/Photo";
import { StatusPill, type Status } from "@/components/site/StatusPill";
import { photoUrl } from "@/lib/photos";

const ogImage = photoUrl("london", 1200) + "&h=630";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Witnessmark — An independent record of GPS interference" },
      { name: "description", content: "Street-level record of GPS jamming and spoofing, turned into a pre-flight check, incident evidence and site monitoring." },
      { property: "og:title", content: "Witnessmark — An independent record of GPS interference" },
      { property: "og:description", content: "Street-level record of GPS jamming and spoofing, turned into decisions." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: ogImage },
    ],
  }),
  component: Index,
});

const uses: { title: string; text: string; to: string; status: Status }[] = [
  { title: "Pre-flight check", text: "Before a drone flies: is GPS trustworthy here, right now?", to: "/pre-flight", status: "go" },
  { title: "Incident evidence", text: "After an incident: what was the GPS environment at that time and place?", to: "/evidence", status: "caution" },
  { title: "Site monitoring", text: "For places that rely on GPS: know when interference starts.", to: "/monitor", status: "nogo" },
];

function Index() {
  return (
    <>
      <section className="relative isolate flex min-h-[88vh] items-end overflow-hidden">
        <Photo photo="london" priority className="absolute inset-0 -z-20" />
        <div className="absolute inset-0 -z-10 bg-photo-scrim" />
        <div className="container-wm pb-16 pt-32 md:pb-24">
          <p className="eyebrow">Demo version</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] md:text-6xl">An independent record of GPS interference, at street level.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">Witnessmark records jamming and spoofing where people actually fly, and turns it into decisions.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/demo">Try it</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/product">How it works</Link></Button>
          </div>
          <PhotoCredit photo="london" className="mt-10" />
        </div>
      </section>

      <section className="container-wm py-20">
        <p className="eyebrow">One record, three decisions</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {uses.map((u) => (
            <Link key={u.to} to={u.to} className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-border-strong">
              <StatusPill status={u.status} className="self-start" />
              <h2 className="mt-6 text-xl">{u.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{u.text}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-signal">
                Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-subtle">
          Example statuses shown: <StatusPill status="nodata" /> means no sensor coverage, never a pass.
        </p>
      </section>
    </>
  );
}
