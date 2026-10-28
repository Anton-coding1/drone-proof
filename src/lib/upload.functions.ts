import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseFlightCsv } from "@/lib/csv";

export const MAX_UPLOAD_BYTES = 5_000_000;

/**
 * Receives the original file bytes (base64), computes the SHA-256 fingerprint on the
 * server from exactly those bytes, re-validates the CSV and stores the case.
 * The browser never supplies the fingerprint, so it can't be forged.
 */
export const uploadFlightLog = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      filename: z.string().min(1).max(255),
      fileBase64: z.string().min(4).max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8).regex(/^[A-Za-z0-9+/]+=*$/),
      // For Excel files, the table as CSV (converted in the browser). Ignored for CSV uploads.
      csvText: z.string().max(MAX_UPLOAD_BYTES * 3).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, clientKey, cleanText, sha256Bytes } = await import("@/lib/security.server");
    const ip = clientKey();
    rateLimit("upload", ip, 10, 10 * 60_000);
    rateLimit("upload-global", "all", 300, 60 * 60_000);

    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const bin = atob(data.fileBase64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      throw new Error("The file couldn't be read. Please try again.");
    }
    if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("File too large: maximum 5 MB.");

    const excel = /\.xlsx$/i.test(data.filename);
    if (excel && !data.csvText) throw new Error("The Excel file couldn't be read. Please try again or upload a CSV.");
    if (!excel && !/\.csv$/i.test(data.filename)) throw new Error("Please upload a CSV or Excel (.xlsx) file.");
    const parsed = parseFlightCsv(excel ? data.csvText! : new TextDecoder("utf-8").decode(bytes));
    if ("error" in parsed) throw new Error(parsed.error);
    if (parsed.points.length < 2) throw new Error("The file needs at least two GPS readings.");

    const sha256 = await sha256Bytes(bytes);
    const filename = cleanText(data.filename, 120) || "flight-log.csv";
    const name = cleanText(filename.replace(/\.(csv|xlsx)$/i, "").replace(/[_-]+/g, " "), 120) || "Uploaded flight";
    const p0 = parsed.points[0]!;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sc, error } = await supabaseAdmin.from("scenarios").insert({
      name,
      description: "Uploaded flight log",
      location_name: `${p0.lat.toFixed(4)}, ${p0.lon.toFixed(4)}`,
      is_simulated: false,
      file_sha256: sha256,
      source_filename: filename,
    }).select("id").single();
    if (error || !sc) throw new Error("Could not save the flight log. Please try again.");
    for (let i = 0; i < parsed.points.length; i += 1000) {
      const { error: e } = await supabaseAdmin.from("drone_points")
        .insert(parsed.points.slice(i, i + 1000).map((p) => ({ ...p, scenario_id: sc.id })));
      if (e) {
        await supabaseAdmin.from("scenarios").delete().eq("id", sc.id);
        throw new Error("Could not save the flight points. Please try again.");
      }
    }
    return { id: sc.id, sha256 };
  });
