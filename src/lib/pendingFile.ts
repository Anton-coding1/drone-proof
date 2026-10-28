/** Hands a file the user dropped on one page to the tool on another page (same browser tab, in memory). */
let pending: { kind: "route"; name: string; text: string } | null = null;
export function setPendingFile(p: typeof pending) { pending = p; }
export function takePendingFile(kind: "route") {
  if (pending?.kind !== kind) return null;
  const p = pending; pending = null; return p;
}
