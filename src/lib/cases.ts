import { queryOptions } from "@tanstack/react-query";
import { getCaseData, listCases } from "@/lib/cases.functions";
import { analyse, type Point } from "@/lib/evidence";

export type CasePoint = Point & { fix_type: number | null; alt_m: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadCase(id: string) {
  if (!UUID.test(id)) return { scenario: null, points: [] as CasePoint[], analysis: null };
  const c = await getCaseData({ data: { id } });
  const points = c.points as CasePoint[];
  if (!c.scenario || points.length < 2) return { scenario: c.scenario, points, analysis: null };
  return { scenario: c.scenario, points, analysis: analyse(points, c.events, c.hexes) };
}

export const caseQuery = (id: string) => queryOptions({ queryKey: ["case-v4", id], queryFn: () => loadCase(id), staleTime: 60_000 });

export const casesListQuery = (ids: string[]) => queryOptions({
  queryKey: ["cases-list-v5", ids],
  queryFn: () => listCases({ data: { ids } }),
  staleTime: 60_000,
});

/** Human case ID like WM-DP-3F9A1C, derived from the database id so it is stable. */
export function caseId(uuid: string) {
  return `WM-DP-${uuid.replace(/-/g, "").slice(-6).toUpperCase()}`;
}

export function mmss(points: { t: string }[], i: number | null) {
  if (i == null || !points[i]) return "—";
  const s = Math.round((new Date(points[i]!.t).getTime() - new Date(points[0]!.t).getTime()) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const utc = (t: string) => new Date(t).toISOString().replace("T", " ").slice(0, 19) + " UTC";
export const utcShort = (t: string) => new Date(t).toISOString().slice(11, 19) + " UTC";
