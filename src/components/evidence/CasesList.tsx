import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { caseId, casesListQuery } from "@/lib/cases";
import { myCaseIds } from "@/lib/browserStore";

/** Demo cases for everyone, plus cases uploaded from this browser. Other people's uploads are not listed. */
export function CasesList() {
  const [mine, setMine] = useState<string[] | null>(null);
  useEffect(() => setMine(myCaseIds()), []);
  const { data, isLoading, error, refetch } = useQuery({ ...casesListQuery(mine ?? []), enabled: mine !== null });

  const demos = data?.demos ?? [];
  const own = (data?.own ?? []).sort((a, b) => (mine ?? []).indexOf(a.id) - (mine ?? []).indexOf(b.id));

  return (
    <div className="space-y-10">
      <CaseGroup title="Sample cases" note="Simulated flights, labelled as demo data." rows={demos} loading={isLoading || mine === null} />
      {own.length > 0 && <CaseGroup title="Your uploads" note="Only listed in this browser." rows={own} loading={false} />}
      {error && (
        <p className="rounded-lg border border-bad/40 px-4 py-3 text-sm text-bad">
          Cases couldn't be loaded. <button type="button" onClick={() => refetch()} className="underline">Try again</button>
        </p>
      )}
    </div>
  );
}

type Row = { id: string; name: string; description: string | null; location_name: string | null; is_simulated: boolean; created_at: string };

function CaseGroup({ title, note, rows, loading }: { title: string; note: string; rows: Row[]; loading: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg">{title}</h3>
        <p className="text-sm text-subtle">{note}</p>
      </div>
      <ul className="mt-4 divide-y border-y">
        {loading && [0, 1, 2].map((i) => <li key={i} className="py-5"><div className="h-5 w-2/3 animate-pulse rounded bg-muted" /></li>)}
        {rows.map((c) => (
          <li key={c.id}>
            <Link to="/analysis/$scenarioId" params={{ scenarioId: c.id }} className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-5 sm:grid-cols-[1fr_auto_auto_auto]">
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{c.description ?? c.location_name ?? "Location not recorded"}</span>
              </span>
              <span className="hidden font-mono text-xs text-subtle sm:block">{caseId(c.id)}</span>
              <span className={`hidden rounded-full border px-2.5 py-0.5 font-mono text-[11px] sm:inline-flex ${c.is_simulated ? "border-warn/40 text-warn" : "border-good/40 text-good"}`}>
                {c.is_simulated ? "Demo" : "Uploaded"}
              </span>
              <ArrowRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {!loading && rows.length === 0 && <li className="py-6 text-sm text-muted-foreground">No cases yet.</li>}
      </ul>
    </div>
  );
}
