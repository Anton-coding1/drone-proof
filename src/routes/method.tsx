import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose } from "@/components/wm/ui";
import { THRESHOLDS as EV, VERDICTS, type VerdictKey } from "@/lib/evidence";
import { PRIOR, THRESHOLDS as RT, VULNERABILITY, type ConsequenceClass, type VulnKey } from "@/lib/routeRisk";
import { METHOD_VERSION, ROUTE_METHOD_VERSION } from "@/lib/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/method")({
  head: () => ({ meta: seo({ title: "Method", description: "How Witnessmark works: the two-witness incident evidence method, the pre-flight decision method and the ground sensor method, with every threshold, data source and limitation.", type: "article" }) }),
  component: Method,
});

const TOC = [
  ["evidence", "Incident evidence method"],
  ["pre-flight", "Pre-flight decision method"],
  ["sensors", "Ground sensor detection method"],
  ["sources", "Data sources"],
  ["limitations", "Limitations"],
  ["changelog", "Changelog"],
];

function Method() {
  return (
    <Page>
      <PageIntro eyebrow={`Evidence ${METHOD_VERSION} · Pre-flight ${ROUTE_METHOD_VERSION} · Sensors v0.1`} title="The method, in full." lead="Every rule, threshold and limitation behind Witnessmark's results. Published so they can be checked, challenged and improved." />
      <Container className="grid grid-cols-1 gap-12 py-16 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">On this page</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {TOC.map(([id, l]) => <li key={id}><a href={`#${id}`} className="text-muted-foreground hover:text-foreground">{l}</a></li>)}
          </ul>
        </nav>
        <Prose>
          <p className="text-[17px] text-foreground">Witnessmark gives decision support, not legal proof. Every output states its confidence and limitations, and all thresholds below are provisional until they have been validated on real flights and claims.</p>

          <h2 id="evidence">Incident evidence method {METHOD_VERSION}</h2>
          <p><strong>Purpose.</strong> To give claims handlers a neutral, repeatable assessment of whether GPS interference is consistent with a drone incident, or whether pilot input or hardware should be examined instead.</p>
          <p><strong>Two independent witnesses.</strong> The drone's own GPS receiver (from its flight log), and GPS quality reported by aircraft overhead at the same place and time. Neither is controlled by the insurer or the operator.</p>
          <h3>Witness 1: the drone log (any check met = drone evidence present)</h3>
          <ul>
            <li><strong>E1</strong> The receiver's jamming state or spoofing state equals 3 (detected) at any point. If the log has no such fields, E1 is "not assessable", never "passed".</li>
            <li><strong>E2</strong> Accuracy goes from under {EV.e2AccuracyBefore} m to over {EV.e2AccuracyAfter} m within {EV.e2WindowS} seconds while the satellite count drops by {EV.e2SatDrop} or more.</li>
            <li><strong>E3</strong> Two consecutive positions imply a speed over {EV.e3SpeedMs} m/s — a possible spoofing sign.</li>
          </ul>
          <h3>Witness 2: aircraft overhead</h3>
          <ul>
            <li><strong>S1</strong> A reported jamming or spoofing event within {EV.skyEventRadiusKm} km overlaps the flight in time.</li>
            <li><strong>S2</strong> At least {EV.skyMinAircraft} aircraft were recorded within {EV.skyHexMaxKm} km in the flight's hour, and more than {EV.skyDegradedShare * 100}% of them reported degraded GPS (NIC below 7 or NACp below 8).</li>
            <li>Aircraft evidence is <strong>present</strong> if S1 or S2 is met; <strong>not determinable</strong> if neither is met and fewer than {EV.skyMinAircraft} aircraft were overhead; otherwise <strong>absent</strong>.</li>
          </ul>
          <h3>How findings are decided</h3>
          <div className="not-prose overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-subtle"><tr className="border-b"><th className="px-4 py-3 font-medium" /><th className="px-4 py-3 font-medium">Aircraft: present</th><th className="px-4 py-3 font-medium">Aircraft: absent</th></tr></thead>
              <tbody className="divide-y">
                {(["yes", "no"] as const).map((d) => (
                  <tr key={d}>
                    <th className="px-4 py-4 font-medium text-foreground">Drone: {d === "yes" ? "present" : "absent"}</th>
                    {(["yes", "no"] as const).map((s) => { const v = VERDICTS[`${d}-${s}` as VerdictKey]; return <td key={s} className="px-4 py-4 align-top text-foreground">{v.title}<span className="mt-1 block text-muted-foreground">{v.confidence} confidence</span></td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>If aircraft evidence is not determinable, only the drone row is used and confidence is capped at Medium.</p>
          <h3>Confidence</h3>
          <ul>
            <li><strong>High</strong>: both witnesses were available and agree.</li>
            <li><strong>Medium</strong>: only one witness could be assessed, or they disagree in a way the method explains.</li>
            <li><strong>Low</strong>: the log has fewer than {EV.minPoints} readings, or no accuracy, satellite or alarm fields at all.</li>
          </ul>
          <h3>Provenance and review</h3>
          <p>Uploaded files are fingerprinted with SHA-256 on arrival; a copy can be checked against the case at any time. Each case keeps a hash-chained audit trail, and a reviewer must confirm every evidence item before signing off. A reviewer can override the finding with a written reason; the automated finding is kept alongside. An optional narrative can be drafted by a language model from the evidence table only, and is labelled as machine-drafted.</p>

          <h2 id="pre-flight">Pre-flight decision method {ROUTE_METHOD_VERSION}</h2>
          <p>Each route is cut into sections (250 m to 2 km). For every section the check estimates the chance of losing trustworthy navigation and compares it with a threshold set by what is on the ground. The worst section decides the route.</p>
          <h3>Step 0: hard stops</h3>
          <p>A notified GNSS-interference area (NOTAM or red AIC area), restricted airspace without permission, or weather outside the drone's limits makes the route NO-GO. Today the operator declares these; automatic NOTAM import is planned.</p>
          <h3>Step 1: chance of interference</h3>
          <p>Start from a base rate for the area — {Object.entries(PRIOR).map(([k, v]) => `${k} ${v * 100}%`).join(", ")} per section-hour — then multiply the odds by each clue (likelihood ratios):</p>
          <ul>
            <li>Aircraft within 10 km over the last 30 days, judged with a Beta posterior: at least 20% degraded even on the cautious lower bound ×200; at least 5% ×30; up to 20% possible (90% upper bound) ×10; up to 5% ×3; clean with 20+ reports ×0.8. Fewer than 5 reports, or fewer than 20 with none degraded, count as no evidence either way; they lower the confidence instead.</li>
            <li>Reported jamming/spoofing event within 50 km: last 24 hours ×5, last 7 days ×2.</li>
            <li>An event at a major venue during the flight: within 2 km ×5, within 5 km ×2.</li>
            <li>Route near major roads (in-car jammers) ×1.5.</li>
          </ul>
          <h3>Step 2: natural degradation</h3>
          <p>A geomagnetic storm forecast of G3 adds 2%, G4 or worse 10% (from NOAA's Kp forecast when available). Dense high-rise along the route adds 5% for poor satellite geometry and multipath. These combine with interference as independent risks.</p>
          <h3>Step 3: drone vulnerability</h3>
          <p>Start at 1.0 (single-band, GNSS-only) and multiply, clamped between 0.05 and 1.0:</p>
          <ul>
            {(Object.keys(VULNERABILITY) as VulnKey[]).map((k) => <li key={k}>{VULNERABILITY[k].label}: ×{VULNERABILITY[k].factor}</li>)}
            <li>Time to a safe landing longer than the dead-reckoning limit: ×1.5</li>
          </ul>
          <h3>Step 4: ground consequence and thresholds</h3>
          <div className="not-prose overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-subtle"><tr className="border-b"><th className="px-4 py-3 font-medium">Class</th><th className="px-4 py-3 font-medium">Ground</th><th className="px-4 py-3 font-medium">GO</th><th className="px-4 py-3 font-medium">CAUTION</th><th className="px-4 py-3 font-medium">NO-GO</th></tr></thead>
              <tbody className="divide-y font-mono text-foreground">
                {(Object.keys(RT) as ConsequenceClass[]).map((c) => (
                  <tr key={c}><td className="px-4 py-3">{c}</td><td className="px-4 py-3 font-sans text-muted-foreground">{RT[c].density}</td><td className="px-4 py-3">&lt; {RT[c].go * 100}%</td><td className="px-4 py-3">{RT[c].go * 100}–{RT[c].nogo * 100}%</td><td className="px-4 py-3">≥ {RT[c].nogo * 100}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Ground consequence currently uses a coarse London distance model (or the operator's choice); census population grids are the next step. The whole route is also checked as one: the combined chance of loss across all sections is held to the strictest class on the route.</p>
          <h3>Confidence</h3>
          <ul>
            <li><strong>High</strong>: a Witnessmark ground sensor within 1 km with 14+ days of data, plus fresh aircraft data. Not yet available: the sensor network isn't deployed.</li>
            <li><strong>Medium</strong>: 20+ aircraft reports near the section, the newest within 7 days of the flight.</li>
            <li><strong>Low</strong>: otherwise. In populated areas (C3, C4), a Low-confidence section can never be GO; it is shown as CAUTION — data-limited.</li>
          </ul>
          <p>Each result shows its top drivers, a suggested extra ground-risk buffer (2 m/s drift over the drone's holdover time) and conditions for flying under CAUTION. The PDF export carries a SHA-256 fingerprint of the full assessment.</p>

          <h2 id="sensors">Ground sensor detection method v0.1</h2>
          <p><strong>Purpose.</strong> To record GPS jamming and spoofing at street level, where aircraft can't see it, with the evidence for every event. The sensors are in development: this method has been tested on simulated data only, and no live sensor data is used anywhere on this site yet.</p>
          <p><strong>Hardware.</strong> A receive-only multi-band GNSS receiver with a fixed antenna, logging its own health once a second. Nothing is ever transmitted.</p>
          <p><strong>Learning the site.</strong> For the first 30 minutes the sensor only learns: the usual strength of its strongest satellites, its front-end gain and its jamming indicator, and its own surveyed position. After that, the baseline keeps rolling over the last six hours of clean data.</p>
          <h3>Signs checked every second</h3>
          <ul>
            <li><strong>G1</strong> The strongest satellites above 15° all weaken together, by at least 4 dB-Hz and well beyond normal variation (jamming; an obstruction only blocks some satellites).</li>
            <li><strong>G2</strong> The front-end gain moves at least 15% from normal (extra energy in the band).</li>
            <li><strong>G3</strong> The receiver's jamming indicator rises by at least 15, or the receiver raises its own jamming flag.</li>
            <li><strong>G4</strong> The position fix is lost while other signs are present.</li>
            <li><strong>G5</strong> The fixed antenna appears to move at least 30 m (100 m counts on its own) while the receiver claims good accuracy, or the receiver raises its spoofing flag (spoofing).</li>
            <li><strong>G6</strong> Signals become at least 4 dB-Hz stronger than normal (supports spoofing).</li>
          </ul>
          <p><strong>Events.</strong> An event opens when the signs add up for at least 5 seconds in a row, and closes after 30 quiet seconds or a gap in the data. A 2-second glitch or a lorry parking in front of the antenna does not count.</p>
          <p><strong>Confidence.</strong> High with three independent kinds of sign, or two plus the receiver's own flag; Medium with two; Low otherwise.</p>
          <p><strong>Privacy.</strong> The antenna's exact position never leaves the device. Exported events carry a site name and an area only.</p>
          <p><strong>Validation.</strong> Every jamming exercise the CAA announces in advance is a test: we will publish matches, misses and false alarms here before relying on sensor data in any product.</p>

          <h2 id="sources">Data sources</h2>
          <ul>
            <li><strong>Aircraft GPS quality and interference events</strong>: Stanford GPS Laboratory (<a href="https://rfi.stanford.edu" target="_blank" rel="noreferrer">rfi.stanford.edu</a>), derived from ADS-B broadcasts. Licence CC BY-NC 4.0; a commercial licence will be in place before the service is sold.</li>
            <li><strong>Space weather</strong>: NOAA Space Weather Prediction Center planetary K-index forecast.</li>
            <li><strong>Flight logs</strong>: supplied by the claimant or operator, fingerprinted on upload.</li>
            <li><strong>Venue locations</strong>: public locations of major London venues. Event calendars are not connected yet.</li>
            <li><strong>Witnessmark ground sensors</strong>: our own receive-only receivers. In development; not yet used in any result.</li>
            <li><strong>Maps</strong>: © OpenStreetMap contributors (ODbL).</li>
          </ul>

          <h2 id="limitations">Limitations</h2>
          <ul>
            <li>Aircraft observe GPS quality at altitude. Low-power jammers near the ground may affect a drone without reaching any aircraft. Our ground sensors are designed to close this gap but are not yet deployed.</li>
            <li>Aircraft coverage is thin in some places and hours (especially late at night), which limits the second witness and the route check's confidence.</li>
            <li>Logs without jamming or spoofing fields rely on E2 and E3 only. DJI logs need a decrypted export.</li>
            <li>A fingerprint shows a file hasn't changed since upload. It does not show the log was accurate when recorded.</li>
            <li>Interference is caused by people and is often unannounced. No pre-flight check can catch every case; in-flight monitoring and failsafes remain essential.</li>
            <li>Control-link and video-link jamming are outside this method for now.</li>
            <li>All weights and thresholds are provisional and have not yet been validated on real claims or flights.</li>
          </ul>
          <p>Questions and challenges to the method are welcome.</p>

          <h2 id="changelog">Changelog</h2>
          <ul>
            <li><strong>Ground sensors v0.1</strong> (Oct 2026): first published detection method (G1–G6), tested on simulated data.</li>
            <li><strong>Site</strong> (Oct 2026): aircraft data can now be imported from our data collector; sparse but clean aircraft data no longer counts against a route.</li>
            <li><strong>Evidence v0.4</strong> (Oct 2026): aircraft readings must be within {EV.skyHexMaxKm} km of the flight; an overlapping reported event counts even when few aircraft were overhead; Low confidence defined for sparse logs; checks renamed E1–E3 and S1–S2; reviewer sign-off and hash-chained audit trail added.</li>
            <li><strong>Pre-flight v0.2</strong> (Oct 2026): first published version — probability × vulnerability × consequence, hard stops, confidence rules.</li>
            <li><strong>Evidence v0.3</strong>: confidence levels defined; neutral wording; limitations published.</li>
            <li><strong>Evidence v0.2</strong>: aircraft evidence and the 2×2 finding table added.</li>
            <li><strong>Evidence v0.1</strong>: drone-log checks.</li>
          </ul>
        </Prose>
      </Container>
    </Page>
  );
}
