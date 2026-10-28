import { describe, expect, it } from "vitest";
import { appendAudit, verifyAudit } from "@/lib/caseLog";

describe("Audit trail hash chain", () => {
  it("verifies an intact chain and detects an edited entry", async () => {
    let a = await appendAudit([], { actor: "System", action: "Flight log received", at: "2026-10-16T10:00:00Z" });
    a = await appendAudit(a, { actor: "System", action: "Analysis run" });
    a = await appendAudit(a, { actor: "Sam", action: "Marked as reviewed" });
    expect(await verifyAudit(a)).toBe(-1);
    const edited = a.map((e, i) => (i === 1 ? { ...e, action: "Something else" } : e));
    expect(await verifyAudit(edited)).toBe(1);
  });
});
