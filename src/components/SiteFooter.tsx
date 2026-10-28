import { Link } from "@tanstack/react-router";
import { FOOTER } from "@/lib/nav";
import { DISCLAIMER } from "@/lib/site";
import { Wordmark } from "@/components/wm/ui";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" aria-label="Witnessmark home"><Wordmark className="text-lg" /></Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              An independent record of GPS jamming and spoofing at street level: a decision before a drone flies, evidence after an incident.
            </p>
            <p className="mt-4 inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] text-subtle">Demo version</p>
          </div>
          {FOOTER.map((g) => (
            <nav key={g.label} aria-label={g.label}>
              <p className="eyebrow">{g.label}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} {...(l.hash ? { hash: l.hash } : {})} className="text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 space-y-3 border-t pt-8 text-xs leading-5 text-subtle">
          <p className="max-w-3xl">{DISCLAIMER}</p>
          <p>
            Aircraft data: Stanford GPS Laboratory (<a className="underline underline-offset-2 hover:text-foreground" href="https://rfi.stanford.edu" target="_blank" rel="noreferrer">rfi.stanford.edu</a>), CC BY-NC 4.0 · Map data © OpenStreetMap contributors · Photos via Unsplash
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} Witnessmark. A student start-up, London.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
