import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { TABLE_ACCEPT, checkTableName, detectKind, readTableFile } from "@/lib/tabular";
import { setPendingFile } from "@/lib/pendingFile";
import { submitFlightLog } from "@/lib/flightUpload";

const LABEL = { route: "a planned route", flight: "a drone flight log" } as const;

/** One drop zone for every feature: works out what the file is and opens the right result. */
export function DropAnything() {
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handle(file: File) {
    setErr(null);
    const bad = checkTableName(file.name);
    if (bad) return setErr(bad);
    if (file.size > 8_000_000) return setErr("File too large: maximum 8 MB.");
    setStatus("Reading the file…");
    try {
      const t = await readTableFile(file);
      const kind = detectKind(t.text);
      if (!kind || kind === "sensor") {
        setStatus(null);
        return setErr("We couldn't tell what this file is. A route needs lat and lon columns; a flight log needs t, lat, lon, accuracy_m and satellites. See the formats below.");
      }
      setStatus(`This looks like ${LABEL[kind]}. Opening the result…`);
      if (kind === "flight") {
        const id = await submitFlightLog(file, t);
        navigate({ to: "/analysis/$scenarioId", params: { scenarioId: id } });
      } else {
        setPendingFile({ kind: "route", name: file.name, text: t.text });
        navigate({ to: "/pre-flight/check" });
      }
    } catch (e) {
      setStatus(null);
      setErr(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  const busy = status !== null && !err;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !busy) void handle(f); }}
      className={`rounded-2xl border border-dashed p-8 text-center transition-colors sm:p-10 ${drag ? "border-foreground/70 bg-foreground/[0.04]" : "border-foreground/25 bg-card"}`}
    >
      {busy ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" /> : <Upload className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />}
      <p className="mt-4 text-xl font-medium">{drag ? "Drop to check it" : "Drop any file and Witnessmark will tell you"}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">A planned route or a drone flight log, as CSV or Excel (.xlsx). Witnessmark works out which it is and opens the result.</p>
      <input ref={input} type="file" accept={TABLE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handle(f); e.target.value = ""; }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-60">
        {busy ? "Working…" : "Choose a file"}
      </button>
      <p role="status" className="mt-4 min-h-5 text-sm text-muted-foreground">{status && !err ? status : ""}</p>
      {err && <p role="alert" className="mx-auto mt-2 flex max-w-xl items-start gap-2 rounded-lg border border-bad/40 p-3 text-left text-sm text-bad"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{err}</p>}
    </div>
  );
}
