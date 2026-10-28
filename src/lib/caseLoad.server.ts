// Server-only: read a case with the service role. Never import this from client code.
export const SCENARIO_COLS = "id,name,description,location_name,is_simulated,created_at,file_sha256,source_filename";

export async function loadCaseAdmin(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [s, p] = await Promise.all([
    supabaseAdmin.from("scenarios").select(SCENARIO_COLS).eq("id", id).maybeSingle(),
    supabaseAdmin.from("drone_points").select("t,lat,lon,alt_m,accuracy_m,satellites,fix_type,jamming_state,spoofing_state").eq("scenario_id", id).order("t").limit(20000),
  ]);
  if (s.error || p.error) throw new Error("Could not load this case.");
  const points = p.data ?? [];
  if (!s.data || points.length < 2) return { scenario: s.data, points, events: [], hexes: [] };
  const first = points[0]!.t, last = points[points.length - 1]!.t;
  const hourStart = new Date(Math.floor(new Date(first).getTime() / 3600000) * 3600000).toISOString();
  const [ev, hx] = await Promise.all([
    supabaseAdmin.from("sky_events").select("type,lat,lon,start_time,end_time").lte("start_time", last).gte("end_time", first).limit(500),
    supabaseAdmin.from("sky_hexes").select("hour,lat,lon,low_quality_count,total_count").eq("hour", hourStart).limit(5000),
  ]);
  if (ev.error || hx.error) throw new Error("Could not load aircraft data for this case.");
  return { scenario: s.data, points, events: ev.data ?? [], hexes: hx.data ?? [] };
}
