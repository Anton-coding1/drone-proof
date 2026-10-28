import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();

/** Loads one case by its unguessable id (server-side, so uploads need not be publicly listable). */
export const getCaseData = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, clientKey } = await import("@/lib/security.server");
    rateLimit("case", clientKey(), 120, 60_000);
    const { loadCaseAdmin } = await import("@/lib/caseLoad.server");
    return loadCaseAdmin(data.id);
  });

/** Demo cases plus the specific uploads this browser remembers. */
export const listCases = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ids: z.array(uuid).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, clientKey } = await import("@/lib/security.server");
    rateLimit("list", clientKey(), 60, 60_000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SCENARIO_COLS } = await import("@/lib/caseLoad.server");
    const demos = await supabaseAdmin.from("scenarios").select(SCENARIO_COLS).eq("is_simulated", true).order("name").limit(50);
    const own = data.ids.length
      ? await supabaseAdmin.from("scenarios").select(SCENARIO_COLS).in("id", data.ids).eq("is_simulated", false)
      : { data: [], error: null };
    if (demos.error || own.error) throw new Error("Could not load cases.");
    return { demos: demos.data ?? [], own: own.data ?? [] };
  });
