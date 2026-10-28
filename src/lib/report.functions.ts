import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `You draft the narrative section of a Witnessmark incident evidence report for an insurance claims handler.
Tone: neutral, factual, concise. Never sound more certain than the stated confidence level. Prefer "consistent with" to "caused by".
Use ONLY the evidence provided. Refer to evidence items by their IDs (E1, E2, E3 for the drone log; S1, S2 for aircraft overhead). Do not introduce any fact, number or claim that is not in the evidence.
If the data is simulated, say so clearly in the Summary and in Caveats.
Output plain text with exactly these section headings, each on its own line prefixed with "## ":
## Summary
## Timeline
## Evidence from the drone
## Evidence from aircraft overhead
## Caveats
Summary: one or two sentences giving the finding and confidence. Timeline: short dash bullet lines with UTC times. Use "- " for bullets. No markdown bold, no tables. Keep it under 300 words.`;

/**
 * Drafts the narrative for one stored case. The evidence is rebuilt on the server from
 * the database, so callers can't feed arbitrary text to the AI model.
 */
export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      claimRef: z.string().max(40).regex(/^[A-Za-z0-9 _./-]*$/, "Claim reference may only use letters, numbers, spaces and - _ . /"),
    }).parse(d))
  .handler(async ({ data }) => {
    const { rateLimit, clientKey } = await import("@/lib/security.server");
    rateLimit("report", clientKey(), 6, 10 * 60_000);
    rateLimit("report-global", "all", 200, 60 * 60_000);
    const { loadCaseAdmin } = await import("@/lib/caseLoad.server");
    const { analyse } = await import("@/lib/evidence");
    const c = await loadCaseAdmin(data.id);
    if (!c.scenario || c.points.length < 2) throw new Error("This case has no flight data to report on.");
    const a = analyse(c.points, c.events, c.hexes);
    const pts = c.points;
    const evidence = {
      scenario: c.scenario.name, location: c.scenario.location_name, data_is_simulated: c.scenario.is_simulated,
      claim_reference: data.claimRef || "Not provided",
      flight_start_utc: pts[0]!.t, flight_end_utc: pts[pts.length - 1]!.t,
      finding: a.v.title, confidence: a.v.confidence, confidence_reason: a.v.why,
      evidence: a.rules.map((r) => ({ id: r.id, source: r.source, check: r.label, result: r.result, observed: r.observed, threshold: r.threshold, first_at_utc: r.index !== null ? pts[r.index]!.t : null })),
      aircraft_overhead: a.sky.planes, degraded_share_percent: a.sky.degraded === null ? null : Math.round(a.sky.degraded * 100),
      overlapping_events: a.sky.events, limitations: a.limits,
    };
    const input = "Evidence (JSON):\n" + JSON.stringify(evidence, null, 2);
    const anthropicKey = process.env["ANTHROPIC_API_KEY"];
    if (anthropicKey) return { text: await draftWithAnthropic(anthropicKey, input) };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Narrative drafting isn't available on this deployment.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input,
        reasoning: { effort: "low" },
        store: false,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests right now. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
      console.error("AI gateway error", res.status, t.slice(0, 500));
      throw new Error("The narrative couldn't be drafted right now. Please try again later.");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? "AI error");
        } catch (e) { if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e; }
      }
    }
    if (!text.trim()) throw new Error("The AI returned an empty report.");
    return { text: text.trim() };
  });

/** Drafts the narrative with Claude through the Anthropic API (used when ANTHROPIC_API_KEY is set). */
async function draftWithAnthropic(key: string, input: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env["ANTHROPIC_MODEL"] || "claude-sonnet-5-5",
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: input }],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many requests right now. Please try again in a minute.");
      console.error("Anthropic API error", res.status, (await res.text().catch(() => "")).slice(0, 300));
      throw new Error("The narrative couldn't be drafted right now. Please try again later.");
    }
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    if (!text) throw new Error("The AI returned an empty report.");
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("The narrative took too long. Please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
