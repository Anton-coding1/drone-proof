import { parseFlightCsv } from "@/lib/csv";
import { uploadFlightLog } from "@/lib/upload.functions";
import { rememberCase } from "@/lib/browserStore";
import { checkTableName, readTableFile } from "@/lib/tabular";
import { MAX_UPLOAD_BYTES } from "@/lib/upload.functions";

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Checks a flight log (CSV or Excel) in the browser, uploads it and returns the new case id. Throws friendly errors. */
export async function submitFlightLog(file: File, preRead?: { bytes: ArrayBuffer; text: string; excel: boolean }): Promise<string> {
  const bad = checkTableName(file.name);
  if (bad) throw new Error(bad);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large: maximum 5 MB.");
  const t = preRead ?? (await readTableFile(file));
  // Quick check in the browser for instant feedback; the server re-checks everything.
  const parsed = parseFlightCsv(t.text);
  if ("error" in parsed) throw new Error(parsed.error);
  const { id } = await uploadFlightLog({
    data: { filename: file.name.slice(0, 255), fileBase64: toBase64(t.bytes), ...(t.excel ? { csvText: t.text } : {}) },
  });
  rememberCase(id);
  return id;
}
