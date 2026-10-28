import type { Analysis } from "@/lib/evidence";
import { VERDICTS } from "@/lib/evidence";
import type { AuditEntry, Review } from "@/lib/caseLog";
import { METHOD_VERSION } from "@/lib/site";

const latin = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/×/g, "x").replace(/·/g, "-").replace(/[^\t\n\r -\u00ff]/g, "");

const RESULT = { met: "Met", not_met: "Not met", na: "Not assessable" } as const;

export async function downloadCasePdf(o: {
  caseId: string; name: string; location: string | null; simulated: boolean; claimRef: string;
  fingerprint: string; fingerprintKind: string; flightStart: string; flightEnd: string;
  analysis: Analysis; review: Review; audit: AuditEntry[]; narrative: string | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16, BOTTOM = 278;
  let y = 18;
  const ink: [number, number, number] = [20, 24, 32], grey: [number, number, number] = [95, 100, 110];
  const write = (txt: string, size = 9.5, bold = false, color = ink, gap = 4.6, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const w of doc.splitTextToSize(latin(txt), W - 2 * M - indent) as string[]) {
      if (y > BOTTOM) { doc.addPage(); y = 18; }
      doc.text(w, M + indent, y); y += gap;
    }
  };
  const h = (t: string) => { y += 3.5; if (y > BOTTOM - 10) { doc.addPage(); y = 18; } write(t, 11, true, ink, 6); };
  const a = o.analysis;
  const status = o.review.status === "override" ? "Reviewed with override" : o.review.status === "reviewed" ? "Reviewed" : "Draft (not yet reviewed)";

  write("Witnessmark", 16, true, ink, 6);
  write(`Incident evidence report  -  Evidence method ${METHOD_VERSION}`, 9.5, false, grey);
  y += 1;
  write(`Case ${o.caseId}  -  Claim reference: ${o.claimRef || "Not provided"}  -  Status: ${status}`, 9, false, grey);
  write(`Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`, 9, false, grey);
  doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 6;
  if (o.simulated) { write("DEMONSTRATION DATA: this is a simulated flight, not a real incident or claim.", 9.5, true, [150, 100, 0]); y += 1; }

  write(o.name, 13, true, ink, 6);
  write(`${o.location ?? "Location not recorded"}  -  Flight ${o.flightStart.replace("T", " ").slice(0, 19)} to ${o.flightEnd.slice(11, 19)} UTC`, 9, false, grey);

  h("Finding");
  write(a.v.title, 11, true);
  write(`${a.v.confidence} confidence. ${a.v.why}`);
  if (o.review.status === "override" && o.review.override) {
    y += 1;
    write(`Reviewer's finding: ${VERDICTS[o.review.override.key].title}`, 10, true);
    write(`Reason: ${o.review.override.reason}`);
    write("The automated finding above is retained for the record.", 8.5, false, grey);
  }

  h("Evidence");
  for (const r of a.rules) {
    write(`${r.id}  ${r.label}  -  ${RESULT[r.result]}`, 9.5, true);
    write(`Observed: ${r.observed}. Threshold: ${r.threshold}. Source: ${r.source === "drone" ? "drone flight log" : "aircraft overhead (Stanford GPS Laboratory)"}.`, 8.8, false, grey, 4.2, 4);
    y += 0.8;
  }
  const forI = a.rules.filter((r) => r.result === "met").map((r) => r.id);
  const against = a.rules.filter((r) => r.result === "not_met").map((r) => r.id);
  const na = a.rules.filter((r) => r.result === "na").map((r) => r.id);
  write(`Points towards interference: ${forI.join(", ") || "none"}.  Points away: ${against.join(", ") || "none"}.  Not assessable: ${na.join(", ") || "none"}.`, 9);

  h("What would change this finding");
  a.change.forEach((c) => write(`- ${c}`));
  h("Limitations");
  a.limits.forEach((c) => write(`- ${c}`));

  if (o.narrative) {
    h("Narrative (drafted by a language model from the evidence above)");
    for (const raw of o.narrative.split("\n")) {
      const t = raw.trim();
      if (!t) { y += 1.2; continue; }
      if (t.startsWith("## ")) write(t.slice(3), 9.8, true, ink, 5);
      else write(t, 9, false, ink, 4.3);
    }
  }

  h("Provenance");
  write(`${o.fingerprintKind}: ${o.fingerprint}`, 8.5, false, ink, 4.2);
  write("A SHA-256 fingerprint changes completely if a single value in the file changes. It shows the data has not changed since upload; it does not show the log was accurate when recorded.", 8.5, false, grey, 4.2);
  write("Aircraft data: Stanford GPS Laboratory (rfi.stanford.edu), CC BY-NC 4.0.", 8.5, false, grey, 4.2);

  h("Reviewer sign-off");
  if (o.review.status === "draft") write("Not yet reviewed.", 9.5, false, grey);
  else write(`Reviewed by ${o.review.reviewer}${o.review.role ? `, ${o.review.role}` : ""} on ${(o.review.reviewedAt ?? "").replace("T", " ").slice(0, 16)} UTC. Evidence items confirmed: ${o.review.checked.join(", ")}.`);

  h("Audit trail (hash-chained)");
  o.audit.forEach((e) => write(`${e.at.replace("T", " ").slice(0, 19)} UTC  ${e.actor}: ${e.action}${e.detail ? ` (${e.detail})` : ""}  [${e.hash.slice(0, 12)}]`, 8.2, false, ink, 4));

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(...grey);
    doc.text(latin(`Witnessmark incident evidence - ${o.caseId} - Evidence method ${METHOD_VERSION} - Fingerprint ${o.fingerprint.slice(0, 16)}...`), M, 290);
    doc.text(`Page ${p} of ${pages}`, W - M, 290, { align: "right" });
    doc.text("Decision support, not legal proof.", M, 293.5);
  }
  doc.save(`Witnessmark-${o.caseId}${o.claimRef ? "-" + o.claimRef.replace(/[^a-z0-9-]+/gi, "") : ""}.pdf`);
}
