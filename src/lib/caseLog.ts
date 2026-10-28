import { readJson, writeJson } from "@/lib/browserStore";
import type { VerdictKey } from "@/lib/evidence";

export type AuditEntry = { at: string; actor: string; action: string; detail?: string | undefined; prev: string; hash: string };
export type Review = {
  reviewer: string; role: string; checked: string[];
  status: "draft" | "reviewed" | "override";
  override: { key: VerdictKey; reason: string } | null;
  reviewedAt: string | null;
};
export type CaseState = { audit: AuditEntry[]; review: Review; claimRef: string };

const key = (id: string) => `wm:case:${id}`;
export const EMPTY_REVIEW: Review = { reviewer: "", role: "", checked: [], status: "draft", override: null, reviewedAt: null };

export function loadCaseState(id: string): CaseState {
  return readJson<CaseState>(key(id), { audit: [], review: EMPTY_REVIEW, claimRef: "" });
}

export function saveCaseState(id: string, s: CaseState) {
  writeJson(key(id), s);
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Append an entry whose hash covers the previous entry's hash (a simple hash chain). */
export async function appendAudit(audit: AuditEntry[], e: { actor: string; action: string; detail?: string | undefined; at?: string | undefined }): Promise<AuditEntry[]> {
  const prev = audit.length ? audit[audit.length - 1]!.hash : "0".repeat(64);
  const at = e.at ?? new Date().toISOString();
  const hash = await sha256(JSON.stringify({ at, actor: e.actor, action: e.action, detail: e.detail ?? "", prev }));
  return [...audit, { at, actor: e.actor, action: e.action, detail: e.detail, prev, hash }];
}

/** Re-computes every link of the chain. Returns the index of the first broken entry, or -1. */
export async function verifyAudit(audit: AuditEntry[]): Promise<number> {
  let prev = "0".repeat(64);
  for (let i = 0; i < audit.length; i++) {
    const a = audit[i]!;
    const h = await sha256(JSON.stringify({ at: a.at, actor: a.actor, action: a.action, detail: a.detail ?? "", prev }));
    if (a.prev !== prev || a.hash !== h) return i;
    prev = a.hash;
  }
  return -1;
}
