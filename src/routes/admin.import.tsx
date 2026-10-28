import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, FileUp, CircleCheck, TriangleAlert } from "lucide-react";
import { Page } from "@/components/wm/Page";
import { Container, btn } from "@/components/wm/ui";
import { importSkyData } from "@/lib/admin.functions";
import { IMPORT_LIMITS, type SkyKind } from "@/lib/skyImport";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/import")({
  head: () => ({ meta: seo({ title: "Import aircraft data", description: "Operator tool.", noindex: true }) }),
  component: AdminImport,
});

type Summary = { received: number; valid: number; duplicates: number; inserted: number; errors: string[]; dryRun: boolean };
const FILES: { kind: SkyKind; name: string; desc: string }[] = [
  { kind: "events", name: "sky_events.csv", desc: "Reported jamming and spoofing events" },
  { kind: "hexes", name: "sky_hexes.csv", desc: "Hourly aircraft GPS-quality counts" },
];

function AdminImport() {
  const [token, setToken] = useState("");
  const [files, setFiles] = useState<Partial<Record<SkyKind, File>>>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Partial<Record<SkyKind, Summary | { error: string }>>>({});

  async function go(dryRun: boolean) {
    setBusy(true);
    setResults({});
    for (const f of FILES) {
      const file = files[f.kind];
      if (!file) continue;
      if (file.size > IMPORT_LIMITS.maxBytes) { setResults((r) => ({ ...r, [f.kind]: { error: "File is larger than 8 MB. Split it and import in parts." } })); continue; }
      try {
        const csv = await file.text();
        const s = await importSkyData({ data: { token, kind: f.kind, csv, dryRun } });
        setResults((r) => ({ ...r, [f.kind]: s }));
      } catch (e) {
        setResults((r) => ({ ...r, [f.kind]: { error: e instanceof Error ? e.message : "Import failed." } }));
      }
    }
    setBusy(false);
  }

  const ready = token.length > 0 && (files.events || files.hexes);

  return (
    <Page>
      <Container narrow className="py-20">
        <p className="eyebrow flex items-center gap-2"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Operators only</p>
        <h1 className="mt-4 text-[34px] leading-[40px]">Import aircraft data</h1>
        <p className="mt-4 text-muted-foreground">
          Upload the two files written by <code className="font-mono text-foreground">python collector.py --export</code>. Rows are checked on the server, and rows already stored are skipped, so importing the same file twice is safe.
        </p>
        <p className="mt-3 text-sm text-subtle">Data: Stanford GPS Laboratory, CC BY-NC 4.0 — non-commercial use until a commercial licence is in place.</p>

        <form className="mt-10 space-y-6" onSubmit={(e) => { e.preventDefault(); void go(false); }}>
          <label className="block">
            <span className="text-sm font-medium">Import token</span>
            <input
              type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)}
              className="mt-2 block h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
              placeholder="The ADMIN_IMPORT_TOKEN secret"
            />
            <span className="mt-1.5 block text-xs text-subtle">Sent once per file over HTTPS and never stored in the browser.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {FILES.map((f) => (
              <label key={f.kind} className="flex cursor-pointer flex-col rounded-xl border bg-card p-5 hover:border-foreground/30">
                <span className="flex items-center gap-2 font-mono text-sm"><FileUp className="h-4 w-4 text-subtle" aria-hidden="true" />{f.name}</span>
                <span className="mt-1 text-[13px] text-muted-foreground">{f.desc}</span>
                <input type="file" accept=".csv,text/csv" className="mt-4 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-foreground"
                  onChange={(e) => { const file = e.target.files?.[0]; setFiles((s) => ({ ...s, [f.kind]: file })); }} />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!ready || busy} onClick={() => void go(true)} className={btn.secondary}>Check files</button>
            <button type="submit" disabled={!ready || busy} className={btn.primary}>{busy ? "Working…" : "Import"}</button>
          </div>
        </form>

        {Object.keys(results).length > 0 && (
          <div className="mt-10 space-y-4" aria-live="polite">
            {FILES.filter((f) => results[f.kind]).map((f) => {
              const r = results[f.kind]!;
              return (
                <div key={f.kind} className="rounded-xl border p-5">
                  <p className="font-mono text-sm">{f.name}</p>
                  {"error" in r ? (
                    <p className="mt-2 flex items-start gap-2 text-sm text-bad"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{r.error}</p>
                  ) : (
                    <>
                      <p className="mt-2 flex items-center gap-2 text-sm">
                        <CircleCheck className="h-4 w-4 text-good" aria-hidden="true" />
                        {r.dryRun ? "Checked — nothing written yet." : `Imported ${r.inserted.toLocaleString()} row${r.inserted === 1 ? "" : "s"}.`}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        {[["Rows", r.received], ["Valid", r.valid], ["Already stored", r.duplicates], [r.dryRun ? "Would add" : "Added", r.dryRun ? r.valid - r.duplicates : r.inserted]].map(([k, v]) => (
                          <div key={k as string}><dt className="text-xs text-subtle">{k}</dt><dd className="font-mono">{(v as number).toLocaleString()}</dd></div>
                        ))}
                      </dl>
                      {r.errors.length > 0 && (
                        <ul className="mt-4 space-y-1 border-t pt-3 text-[13px] text-warn">
                          {r.errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </Page>
  );
}
