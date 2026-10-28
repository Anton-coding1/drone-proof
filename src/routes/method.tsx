import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/wm/Page";
import { Container, PageIntro, Prose } from "@/components/wm/ui";
import { THRESHOLDS as EV, VERDICTS, type VerdictKey } from "@/lib/evidence";
import { CELL_KM, PRIOR, THRESHOLDS as RT, VULNERABILITY, type ConsequenceClass, type VulnKey } from "@/lib/routeRisk";
import { AIRSPACE_COUNTS } from "@/lib/airspace";
import { BUILDING_RADIUS_M, HIGH_RISE_MIN, ROAD_RADIUS_M } from "@/lib/conditions";
import { METHOD_VERSION, ROUTE_METHOD_VERSION } from "@/lib/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/method")({
  head: () => ({ meta: seo({ title: "Method", description: "How Witnessmark works: the two-witness incident evidence method and the pre-flight decision method, with every threshold, data source and limitation.", type: "article" }) }),
  component: Method,
});

const TOC = [
  ["evidence", "Incident evidence method"],
  ["pre-flight", "Pre-flight decision method"],
  ["sources", "Data sources"],
  ["limitations", "Limitations"],
  ["changelog", "Changelog"],
];

function Method() {
  return (
    <Page>
      <PageIntro eyebrow={`Evidence ${METHOD_VERSION} · Pre-flight ${ROUTE_METHOD_VERSION}`} title="The method, in full." lead="Every rule, threshold and limitation behind Witnessmark's results. Published so they can be checked, challenged and improved." />
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
          <p>An aerodrome flight restriction zone without permission (checked automatically, below), a height above 120 m without an authorisation, weather outside the drone's limits (from the forecast, below), a notified GNSS-interference area (NOTAM or red AIC area) or other restricted airspace without permission makes the route NO-GO. The operator declares the last two; automatic NOTAM import is planned.</p>
          <h3>Airspace (checked automatically)</h3>
          <p>Every section is checked against the flight restriction zone (FRZ) of each protected UK aerodrome: the {AIRSPACE_COUNTS.protected} CAA certificated, CAA licensed and military aerodromes. Under the Air Navigation Order 2016 (articles 94A and 94B) an FRZ runs from the surface to 2,000 ft and is made of:</p>
          <ul>
            <li>the aerodrome traffic zone: a circle of 2 NM (2.5 NM where the longest runway is over 1,850 m), centred on the mid-point of the longest runway;</li>
            <li>a runway protection zone at each runway threshold: 5 km long along the extended centre line and 1 km wide (1.5 km at Heathrow);</li>
            <li>the area out to 1 km beyond the aerodrome boundary (approximated as 1 km around each runway);</li>
            <li>for aerodromes without runway data or a traffic zone: a 2 NM circle.</li>
          </ul>
          <p>A section inside an FRZ is NO-GO until the operator confirms they have permission from that aerodrome's air traffic control (for Heathrow, an Off Airfield Drone Permit through the NATS portal, at least 14 days ahead). A section within 3.7 km of any other UK airfield ({AIRSPACE_COUNTS.airfields} listed) is at least CAUTION until the operator confirms they have checked with it. Central London routes carry a note about restricted areas EG R157, R158 and R159, which need NATS approval and whose exact boundaries are not loaded yet. A planned height above 120 m is NO-GO without a CAA operational authorisation.</p>
          <h3>Conditions filled in automatically</h3>
          <ul>
            <li><strong>Weather</strong>: the Open-Meteo forecast at the start, middle and end of the route for the flight window. The route is NO-GO if the wind at 80 m or the gusts exceed the drone's stated limit, if rain of 0.5 mm/h or more is forecast and the drone isn't rain-rated, if visibility is under 1 km, or if the temperature is outside −10 to 40 °C.</li>
            <li><strong>Major roads</strong>: any motorway or trunk road within {ROAD_RADIUS_M} m of the route, from OpenStreetMap, counts as "near major roads".</li>
            <li><strong>Tall buildings</strong>: {HIGH_RISE_MIN} or more buildings of 10+ floors (or 35 m+) within {BUILDING_RADIUS_M} m, from OpenStreetMap, counts as dense high-rise. Building heights are patchy outside big cities.</li>
            <li><strong>Daylight</strong>: calculated from the sun's position. UK legal night runs from 30 minutes after sunset to 30 minutes before sunrise; at night the "pilot flying by eye" mitigation is not credited.</li>
            <li><strong>Space weather</strong>: NOAA's planetary K-index forecast for the next 24 hours.</li>
          </ul>
          <p>Each automatic value is shown with its source and time, and the operator can override any of them; overrides are recorded in the report.</p>
          <h3>Step 1: chance of interference</h3>
          <p>Start from a base rate for the area — {Object.entries(PRIOR).map(([k, v]) => `${k} ${v * 100}%`).join(", ")} per section-hour — then multiply the odds by each clue (likelihood ratios):</p>
          <ul>
            <li>Aircraft within 10 km over the last 30 days, judged with a Beta posterior: at least 20% degraded even on the cautious lower bound ×200; at least 5% ×30; up to 20% possible (90% upper bound, at least one degraded report) ×10; up to 5% ×3; clean with 20+ reports ×0.8. Fewer than 5 reports, or fewer than 20 with none degraded, count as no evidence either way; they lower the confidence instead.</li>
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
          <p>Ground consequence currently uses a coarse London distance model (or the operator's choice); census population grids are the next step. The whole route is also checked as one: the combined chance of loss is held to the strictest class on the route. Because interference covers an area, neighbouring sections are not independent, so the route is combined in {CELL_KM} km cells (taking the worst section in each). This keeps the result the same whatever section length is chosen.</p>
          <h3>Confidence</h3>
          <ul>
            <li><strong>High</strong>: needs Witnessmark's own interference data near the route, which is still being collected. Not available yet.</li>
            <li><strong>Medium</strong>: 20+ aircraft reports near the section, the newest within 7 days of the flight.</li>
            <li><strong>Low</strong>: otherwise. In populated areas (C3, C4), a Low-confidence section can never be GO; it is shown as CAUTION — data-limited.</li>
          </ul>
          <p>Each result shows its top drivers, a suggested extra ground-risk buffer (2 m/s drift over the drone's holdover time) and conditions for flying under CAUTION. The PDF export carries a SHA-256 fingerprint of the full assessment.</p>

          <h2 id="sources">Data sources</h2>
          <ul>
            <li><strong>Aircraft GPS quality and interference events</strong>: Stanford GPS Laboratory (<a href="https://rfi.stanford.edu" target="_blank" rel="noreferrer">rfi.stanford.edu</a>), derived from ADS-B broadcasts. Licence CC BY-NC 4.0; a commercial licence will be in place before the service is sold.</li>
            <li><strong>Space weather</strong>: NOAA Space Weather Prediction Center planetary K-index forecast.</li>
            <li><strong>Flight logs</strong>: supplied by the claimant or operator, fingerprinted on upload.</li>
            <li><strong>Venue locations</strong>: public locations of major London venues. Event calendars are not connected yet.</li>
            <li><strong>Witnessmark's own data</strong>: being collected; not yet used in any result.</li>
            <li><strong>Airspace</strong>: protected aerodromes from the CAA lists of certificated and licensed aerodromes (October 2026) plus active military airfields; runway coordinates from OurAirports (public domain); zone rules from the Air Navigation Order 2016, articles 94A and 94B. The official shapes are published by NATS (UAS restriction zones, updated every 28 days); importing them is the next step.</li>
            <li><strong>Weather</strong>: Open-Meteo forecast API (CC BY 4.0). The free tier is for non-commercial use; a paid plan will be in place before the service is sold.</li>
            <li><strong>Roads and buildings</strong>: © OpenStreetMap contributors (ODbL), queried live through the Overpass API.</li>
            <li><strong>Maps</strong>: © OpenStreetMap contributors (ODbL).</li>
          </ul>

          <h2 id="limitations">Limitations</h2>
          <ul>
            <li>Aircraft observe GPS quality at altitude. Low-power jammers near the ground may affect a drone without reaching any aircraft. Our own data collection is aimed at this gap.</li>
            <li>Aircraft coverage is thin in some places and hours (especially late at night), which limits the second witness and the route check's confidence.</li>
            <li>Logs without jamming or spoofing fields rely on E2 and E3 only. DJI logs need a decrypted export.</li>
            <li>A fingerprint shows a file hasn't changed since upload. It does not show the log was accurate when recorded.</li>
            <li>Interference is caused by people and is often unannounced. No pre-flight check can catch every case; in-flight monitoring and failsafes remain essential.</li>
            <li>Control-link and video-link jamming are outside this method for now.</li>
            <li>Airport zones are rebuilt from the published rules, so their edges can differ from the official NATS shapes by a few hundred metres. Prison zones, danger areas, temporary restrictions and NOTAMs are not checked automatically: always check the NATS drone map before flying.</li>
            <li>All weights and thresholds are provisional and have not yet been validated on real claims or flights.</li>
          </ul>
          <p>Questions and challenges to the method are welcome.</p>

          <h2 id="changelog">Changelog</h2>
          <ul>
            <li><strong>Site</strong> (Oct 2026): aircraft data can now be imported from our data collector; sparse but clean aircraft data no longer counts against a route.</li>
            <li><strong>Evidence v0.4</strong> (Oct 2026): aircraft readings must be within {EV.skyHexMaxKm} km of the flight; an overlapping reported event counts even when few aircraft were overhead; Low confidence defined for sparse logs; checks renamed E1–E3 and S1–S2; reviewer sign-off and hash-chained audit trail added.</li>
            <li><strong>Pre-flight v0.3</strong> (Oct 2026): automatic airspace check (aerodrome flight restriction zones, other airfields, 120 m height limit) with permission confirmation; weather, major roads, tall buildings and daylight filled in automatically (all can be overridden); the route total now combines sections in {CELL_KM} km cells, so it no longer changes with the section length; the summary names any hard stop; clean aircraft data (no degraded reports) can no longer count as a warning sign.</li>
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
