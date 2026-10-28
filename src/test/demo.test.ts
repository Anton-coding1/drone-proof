import { describe, expect, it } from "vitest";
import { runDemo } from "@/components/home/demoData";

describe("Homepage decision demo tells a sensible story", () => {
  it("gives the expected decision for every scenario and drone", () => {
    const got = (["ordinary", "match", "military", "storm"] as const).map((s) => [s, runDemo(s, false).decision, runDemo(s, true).decision]);
    expect(got).toEqual([
      ["ordinary", "go", "go"],
      ["match", "caution", "go"],
      ["military", "nogo", "nogo"],
      ["storm", "nogo", "nogo"],
    ]);
  });
  it("the route-level chance agrees with the decision for the most sensitive ground", () => {
    const r = runDemo("match", false);
    expect(r.pRoute).toBeGreaterThan(0.01);
    expect(r.pRoute).toBeLessThan(0.05);
  });
});
