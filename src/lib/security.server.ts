// Server-only helpers: client identification, best-effort rate limiting and input cleaning.
import { getRequest } from "@tanstack/react-start/server";

export function clientKey(): string {
  try {
    const h = getRequest().headers;
    const ip = h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return ip || "unknown";
  } catch {
    return "unknown";
  }
}

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/**
 * Fixed-window limiter kept in memory. It is per server instance, so it is a
 * speed bump against scripted abuse rather than a hard guarantee.
 */
export function rateLimit(name: string, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const id = `${name}:${key}`;
  const b = buckets.get(id);
  if (!b || b.reset <= now) {
    buckets.set(id, { count: 1, reset: now + windowMs });
  } else if (b.count >= limit) {
    const mins = Math.max(1, Math.ceil((b.reset - now) / 60000));
    throw new Error(`Too many requests. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
  } else {
    b.count++;
  }
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
}

/** Remove control and bidirectional-override characters, collapse whitespace, cap length. */
export function cleanText(s: string, max: number) {
  return s
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]", "g"), " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function sha256Bytes(bytes: Uint8Array<ArrayBuffer>) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time check of a secret. Both sides are hashed first so the comparison
 * always runs over 32 bytes, whatever the input lengths.
 */
export async function secretMatches(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0 && expected.length > 0;
}
