import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Route as RouteIcon, FileSearch, Siren, ArrowRight } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, btn } from "@/components/wm/ui";
import { FLIGHT_SAMPLES, FORMATS, ROUTE_SAMPLES, SENSOR_SAMPLES, type DemoFile } from "@/lib/demoFiles";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: seo({ title: "Try it with your data", description: "Try every Witnessmark feature with your own files, or with the sample routes, flight logs and sensor logs provided." }) }),
  component: Demo,
});

const SECTIONS: {
  id: string; icon: typeof RouteIcon; name: string; what: string; steps: string[]; tool: { to: string; hash?: string; label: string };
  files: DemoFile[]; format: string; note?: string;
}[] = [
  {
    id: "pre-flight", icon: RouteIcon, name: "Pre-flight check",
    what: "Upload a planned route and get GO, CAUTION or NO-GO for every section, with the reasons and a PDF.",
    steps: ["Download a sample route, or make a CSV of your own waypoints.", "Open the pre-flight check and choose “Upload a route”.", "Change the drone settings to see how the decision moves."],
    tool: { to: "/pre-flight/check", label: "Open the pre-flight check" },
    files: ROUTE_SAMPLES, format: FORMATS.route,
    note: "Results use the simulated aircraft data in the demo database, so each sample sets its own planned start time.",
  },
  {
    id: "evidence", icon: FileSearch, name: "Incident evidence",
    what: "Upload a drone flight log and get a neutral finding on whether GPS interference, the pilot or the hardware is the likely cause.",
    steps: ["Download a sample flight log, or export one from your drone.", "Open incident evidence and upload it.", "Open the case file: finding, evidence, fingerprint, sign-off and PDF."],
    tool: { to: "/evidence", hash: "upload", label: "Open incident evidence" },
    files: FLIGHT_SAMPLES, format: FORMATS.flight,
    note: "Each sample lands in a different box of the finding table. Uploaded logs are stored as cases you can share by link.",
  },
  {
    id: "sites", icon: Siren, name: "Site monitoring",
    what: "Upload a ground sensor log and see every jamming or spoofing event it caught, with evidence and confidence.",
    steps: ["Download a sample sensor log, or record one with the Witnessmark sensor software.", "Open site monitoring and upload it.", "Read the timeline and each event's evidence."],
    tool: { to: "/monitor", label: "Open site monitoring" },
    files: SENSOR_SAMPLES, format: FORMATS.sensor,
    note: "Sensor logs are analysed in your browser and never leave your device.",
  },
];

function Demo() {
  return (
    <Page>
      <PageIntro
        eyebrow="Demo"
        title="Try Witnessmark with your own data."
        lead="Every feature accepts a file. Use your own, or download the samples below: each one is simulated and labelled with the result you should see."
      >
        <ul className="mt-9 flex flex-wrap gap-3">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} className={btn.secondary}><s.icon className="h-4 w-4" aria-hidden="true" />{s.name}</a></li>
          ))}
        </ul>
      </PageIntro>

      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className={`scroll-mt-20 py-20 ${i ? "border-t" : ""}`}>
          <Container className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="flex items-center gap-2 text-sm text-subtle"><s.icon className="h-4 w-4" aria-hidden="true" />{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${s.id}-h`} className="mt-3 text-[28px] leading-[34px] sm:text-[34px] sm:leading-[40px]">{s.name}</h2>
              <p className="mt-4 text-muted-foreground">{s.what}</p>
              <ol className="mt-6 space-y-3 text-sm">
                {s.steps.map((st, n) => (
                  <li key={st} className="flex gap-3"><span className="font-mono text-subtle">{n + 1}</span><span className="text-muted-foreground">{st}</span></li>
                ))}
              </ol>
              <Link to={s.tool.to} {...(s.tool.hash ? { hash: s.tool.hash } : {})} className={`${btn.primary} mt-8`}>{s.tool.label} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <div className="min-w-0">
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Sample files for {s.name}</caption>
                  <thead className="border-b bg-card text-xs text-subtle">
                    <tr><th scope="col" className="px-4 py-3 font-medium">Sample file</th><th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">You should see</th><th scope="col" className="px-4 py-3"><span className="sr-only">Download</span></th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.files.map((f) => (
                      <tr key={f.file} className="align-top">
                        <td className="px-4 py-3.5">
                          <p className="font-medium">{f.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{f.note}</p>
                          <p className="mt-1.5 text-xs text-foreground/80 sm:hidden">→ {f.expect}</p>
                        </td>
                        <td className="hidden px-4 py-3.5 text-muted-foreground sm:table-cell">{f.expect}</td>
                        <td className="px-4 py-3.5 text-right">
                          <a href={`/demo-data/${f.file}`} download className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs text-foreground hover:bg-foreground/[0.05]" aria-label={`Download ${f.name} (${f.file})`}>
                            <Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs leading-5 text-subtle"><span className="text-muted-foreground">Format:</span> {s.format}</p>
              {s.note && <p className="mt-2 text-xs leading-5 text-subtle">{s.note}</p>}
            </div>
          </Container>
        </section>
      ))}
    </Page>
  );
}
