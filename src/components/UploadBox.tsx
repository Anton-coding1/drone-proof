import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Upload, Loader2, Download, AlertCircle } from "lucide-react";
import { submitFlightLog } from "@/lib/flightUpload";
import { TABLE_ACCEPT } from "@/lib/tabular";


export function UploadBox() {
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const id = await submitFlightLog(file);
      navigate({ to: "/analysis/$scenarioId", params: { scenarioId: id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally { setBusy(false); }
  }



  return (
    <section id="upload" aria-labelledby="upload-h" className="scroll-mt-24">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !busy) handle(f); }}
        aria-busy={busy}
        className={`rounded border border-dashed px-6 py-14 text-center transition-colors duration-200 sm:px-12 sm:py-16 ${
          drag ? "border-foreground/70 bg-foreground/[0.03]" : "border-foreground/25 bg-transparent"
        }`}
      >
        {busy
          ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
          : <Upload className={`mx-auto h-8 w-8 transition-colors ${drag ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={1.25} aria-hidden="true" />}
        <h2 id="upload-h" className="mt-5 text-2xl font-normal tracking-tight sm:text-3xl">
          {busy ? "Analysing your flight log…" : drag ? "Drop to analyse" : "Upload a flight log"}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Drag a CSV or Excel (.xlsx) file here, or choose one from your computer. Its SHA-256 fingerprint is computed on our server from the exact bytes received. This is a prototype, so please don't upload confidential logs.
        </p>
        <p className="mx-auto mt-3 max-w-xl font-mono text-xs leading-relaxed text-muted-foreground/80">
          t, lat, lon, alt_m, satellites, accuracy_m, fix_type, jamming_state*, spoofing_state*
          <span className="block">* optional · CSV or Excel (.xlsx), first sheet, up to 5 MB</span>
        </p>
        <input ref={input} type="file" accept={TABLE_ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }} />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60">
            {busy ? "Analysing…" : "Choose file →"}
          </button>
          <Link to="/demo" hash="evidence"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Sample flight logs
          </Link>
        </div>
        {err && (
          <p role="alert" className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded border border-bad/40 p-3 text-left text-sm text-bad">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {err}
          </p>
        )}
      </div>
    </section>
  );
}
