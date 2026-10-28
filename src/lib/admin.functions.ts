import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IMPORT_LIMITS, parseSkyCsv, skyKey, type EventRow, type HexRow } from "@/lib/skyImport";

/**
 * Imports aircraft GPS-quality data exported by `collector.py --export`.
 *
 * Protected by the ADMIN_IMPORT_TOKEN secret (at least 24 characters). Without it the
 * endpoint is switched off. The token is checked in constant time and attempts are rate
 * limited per IP, so it can't be guessed by brute force. Rows are validated on the server
 * and duplicates of rows already stored are skipped, so re-importing a file is safe.
 */
export const importSkyData = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token: z.string().min(1).max(256),
      kind: z.enum(["events", "hexes"]),
      csv: z.string().min(1).max(IMPORT_LIMITS.maxBytes),
      dryRun: z.boolean(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, clientKey, secretMatches } = await import("@/lib/security.server");
    const ip = clientKey();
    rateLimit("admin", ip, 10, 15 * 60_000);
    rateLimit("admin-global", "all", 60, 60 * 60_000);

    const expected = process.env["ADMIN_IMPORT_TOKEN"] ?? "";
    if (expected.length < 24) throw new Error("Import is switched off on this deployment.");
    if (!(await secretMatches(data.token, expected))) {
      console.warn("admin import: rejected token", { ip: ip.slice(0, 64) });
      throw new Error("That token isn't valid.");
    }

    const parsed = data.kind === "events" ? parseSkyCsv("events", data.csv) : parseSkyCsv("hexes", data.csv);
    const rows = parsed.rows as (EventRow | HexRow)[];
    const summary = { received: parsed.received, valid: rows.length, duplicates: 0, inserted: 0, errors: parsed.errors, dryRun: data.dryRun };
    if (!rows.length) return summary;

    // Skip rows we already hold (same place and time), and duplicates inside the file.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const timeCol = data.kind === "events" ? "start_time" : "hour";
    const times = rows.map((r) => (data.kind === "events" ? (r as EventRow).start_time : (r as HexRow).hour)).sort();
    const seen = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const q = data.kind === "events"
        ? supabaseAdmin.from("sky_events").select("type, lat, lon, start_time")
        : supabaseAdmin.from("sky_hexes").select("hour, lat, lon");
      const { data: page, error } = await q.gte(timeCol, times[0]!).lte(timeCol, times.at(-1)!).range(from, from + 999);
      if (error) throw new Error("Couldn't read existing data. Nothing was imported.");
      for (const r of page ?? []) seen.add(skyKey(data.kind, r as EventRow | HexRow));
      if (!page || page.length < 1000 || from > 500_000) break;
    }
    const fresh = rows.filter((r) => {
      const k = skyKey(data.kind, r);
      if (seen.has(k)) { summary.duplicates++; return false; }
      seen.add(k);
      return true;
    });
    if (data.dryRun) return summary;

    for (let i = 0; i < fresh.length; i += 1000) {
      const chunk = fresh.slice(i, i + 1000);
      const { error } = data.kind === "events"
        ? await supabaseAdmin.from("sky_events").insert(chunk as EventRow[])
        : await supabaseAdmin.from("sky_hexes").insert(chunk as HexRow[]);
      if (error) {
        console.error("admin import: insert failed", error.message);
        summary.errors = [...summary.errors, `Stopped after ${summary.inserted} rows: the database rejected a batch. Re-running the import is safe; rows already stored are skipped.`];
        return summary;
      }
      summary.inserted += chunk.length;
    }
    console.info("admin import", { kind: data.kind, inserted: summary.inserted, duplicates: summary.duplicates });
    return summary;
  });
