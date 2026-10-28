import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const groups: { title: string; links: { label: string; to: string; hash?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Overview", to: "/product" },
      { label: "Pre-flight check", to: "/pre-flight" },
      { label: "Incident evidence", to: "/evidence" },
      { label: "Site monitoring", to: "/monitor" },
      { label: "Ground sensors", to: "/network" },
      { label: "Try it", to: "/demo" },
    ],
  },
  { title: "Method", links: [{ label: "Method & limitations", to: "/method" }] },
  { title: "Company", links: [{ label: "About", to: "/about" }, { label: "Trust & security", to: "/trust" }] },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Accessibility", to: "/accessibility" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-background">
      <div className="container-wm py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground">An independent, street-level record of GPS jamming and spoofing.</p>
            <span className="mt-4 inline-flex items-center rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-subtle">Demo version</span>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <p className="eyebrow mb-3">{g.title}</p>
              <ul className="space-y-1">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 space-y-3 border-t border-border pt-6 text-[12px] leading-relaxed text-subtle">
          <p>Witnessmark provides decision support. It is not legal proof and does not replace operator judgement, a loss adjuster or CAA requirements.</p>
          <p>
            Aircraft data:{" "}
            <a href="https://rfi.stanford.edu" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Stanford GPS Laboratory (rfi.stanford.edu)</a>, CC BY-NC 4.0 · Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">OpenStreetMap contributors</a> · Photos via{" "}
            <a href="https://unsplash.com/?utm_source=witnessmark&utm_medium=referral" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Unsplash</a>
          </p>
          <p className="font-mono">© {new Date().getFullYear()} Witnessmark</p>
        </div>
      </div>
    </footer>
  );
}
