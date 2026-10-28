import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => new Request("https://x.test", { headers: { "cf-connecting-ip": "1.2.3.4" } }) }));
const { cleanText, rateLimit, clientKey, sha256Bytes } = await import("@/lib/security.server");

describe("Server security helpers", () => {
  it("strips control and right-to-left override characters from names", () => {
    expect(cleanText("invoice‮gpj.csv", 50)).toBe("invoice gpj.csv");
    expect(cleanText("a\u0000b\nc\td", 50)).toBe("a b c d");
    expect(cleanText("x".repeat(300), 120)).toHaveLength(120);
  });

  it("rate-limits after the allowed number of requests", () => {
    for (let i = 0; i < 3; i++) rateLimit("t", "k", 3, 60_000);
    expect(() => rateLimit("t", "k", 3, 60_000)).toThrow(/Too many requests/);
    expect(() => rateLimit("t", "other", 3, 60_000)).not.toThrow();
  });

  it("identifies the client from the edge header", () => {
    expect(clientKey()).toBe("1.2.3.4");
  });

  it("hashes bytes with SHA-256", async () => {
    expect(await sha256Bytes(new TextEncoder().encode("abc") as Uint8Array<ArrayBuffer>)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
