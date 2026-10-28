import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { detectKind, excelToCsv, checkTableName } from "@/lib/tabular";
import { parseFlightCsv } from "@/lib/csv";

const ab = (p: string) => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

describe("Excel uploads work like CSV", () => {
  it("reads a flight log from Excel with the same readings and times as the CSV", async () => {
    const csv = parseFlightCsv(readFileSync("public/demo-data/flight-tromso-local-jammer.csv", "utf8"));
    const xl = await excelToCsv(ab("public/demo-data/flight-tromso-local-jammer.xlsx"));
    expect(detectKind(xl)).toBe("flight");
    const fromXl = parseFlightCsv(xl);
    if ("error" in csv || "error" in fromXl) throw new Error("parse failed");
    expect(fromXl.points.length).toBe(csv.points.length);
    expect(fromXl.points[0]!.t).toBe(csv.points[0]!.t);
    expect(fromXl.points[150]!.jamming_state).toBe(3);
  });
  it("reads a route with its planned start from Excel", async () => {
    const xl = await excelToCsv(ab("public/demo-data/route-gdansk-bay.xlsx"));
    expect(detectKind(xl)).toBe("route");
    expect(xl.split("\n")[1]).toBe("54.36,18.42,2026-09-20T15:30:00Z");
  });
  it("tells people what to do with the wrong file type", () => {
    expect(checkTableName("log.xls")).toMatch(/save the spreadsheet/);
    expect(checkTableName("log.pdf")).toMatch(/CSV or Excel/);
    expect(checkTableName("log.XLSX")).toBeNull();
  });
});
