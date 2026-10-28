/**
 * Reads an uploaded table, CSV or Excel (.xlsx), and returns it as CSV text so every
 * parser on the site can stay CSV-only. Excel is converted in the browser.
 */
export const TABLE_ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const TABLE_HINT = "CSV or Excel (.xlsx)";

export const isExcel = (name: string) => /\.xlsx$/i.test(name);

export function checkTableName(name: string): string | null {
  if (/\.(csv|xlsx)$/i.test(name)) return null;
  if (/\.(xls|xlsm|numbers|ods)$/i.test(name)) return "Please save the spreadsheet as Excel (.xlsx) or CSV and try again.";
  return "Please choose a CSV or Excel (.xlsx) file.";
}

type Cell = string | number | boolean | Date | null | undefined;

function cellText(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    // Excel stores times as fractions of a day; round away floating-point drift to the nearest second.
    return new Date(Math.round(v.getTime() / 1000) * 1000).toISOString().replace(".000Z", "Z");
  }
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  // Our CSV parsers don't use quoting, so commas inside text would shift columns.
  return String(v).replace(/[,;\t\r\n]+/g, " ").trim();
}

export async function excelToCsv(buf: ArrayBuffer): Promise<string> {
  const { readSheet } = await import("read-excel-file/universal");
  let rows: Cell[][];
  try {
    // Copy into a fresh buffer: some environments hand over buffers the reader doesn't recognise.
    const copy = new Uint8Array(buf.byteLength);
    copy.set(new Uint8Array(buf));
    rows = (await readSheet(copy.buffer)) as Cell[][];
  } catch {
    throw new Error("This Excel file couldn't be read. Make sure the data is on the first sheet, save as .xlsx (or CSV) and try again.");
  }
  // Drop fully empty rows (Excel often has trailing blanks).
  return rows.filter((r) => r.some((c) => cellText(c) !== "")).map((r) => r.map(cellText).join(",")).join("\n");
}

/** Returns the original bytes (for fingerprints) and the table as CSV text. */
export async function readTableFile(file: File): Promise<{ bytes: ArrayBuffer; text: string; excel: boolean }> {
  const bytes = await file.arrayBuffer();
  const excel = isExcel(file.name);
  const text = excel ? await excelToCsv(bytes) : new TextDecoder().decode(bytes);
  return { bytes, text, excel };
}

export type TableKind = "route" | "flight" | "sensor";

/** Works out which feature a table belongs to from its header row. */
export function detectKind(csv: string): TableKind | null {
  const first = csv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const h = new Set(first.split(delim).map((c) => c.trim().toLowerCase().replace(/"/g, "")));
  if (h.has("cno_top")) return "sensor";
  if (h.has("t") && (h.has("accuracy_m") || h.has("satellites"))) return "flight";
  if ((h.has("lat") || h.has("latitude")) && (h.has("lon") || h.has("lng") || h.has("longitude"))) return "route";
  return null;
}
