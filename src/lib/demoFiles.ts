/** Simulated sample files served from /public/demo-data, one set per feature. */
export type DemoFile = { file: string; name: string; note: string; expect: string };

export const ROUTE_SAMPLES: DemoFile[] = [
  { file: "route-greenwich-park.csv", name: "Greenwich Park hop", note: "Short urban flight with plenty of clean aircraft data", expect: "GO" },
  { file: "route-london-hospitals.csv", name: "Central London hospital link", note: "Densely populated ground", expect: "NO-GO: over very dense ground, the small chance on each section adds up across the route" },
  { file: "route-wembley-match-day.csv", name: "Wembley on match day", note: "Sets an event at Wembley Stadium", expect: "CAUTION: an event at the stadium raises the risk" },
  { file: "route-oxfordshire-survey.csv", name: "Oxfordshire field survey", note: "No aircraft data nearby", expect: "CAUTION: thin data is never GO over people" },
  { file: "route-gdansk-bay.csv", name: "Gdańsk Bay", note: "Sets the start time inside a simulated jamming event", expect: "NO-GO" },
];

export const FLIGHT_SAMPLES: DemoFile[] = [
  { file: "flight-gdansk-area-jamming.csv", name: "Area jamming, drone affected", note: "Gdańsk Bay", expect: "Consistent with external GPS interference" },
  { file: "flight-tromso-local-jammer.csv", name: "Local jammer", note: "Tromsø; aircraft overhead saw nothing", expect: "Consistent with local GPS interference" },
  { file: "flight-london-spoofed.csv", name: "Spoofed position", note: "London; the receiver flags spoofing and the position jumps", expect: "Consistent with local GPS interference" },
  { file: "flight-gdansk-drone-unaffected.csv", name: "Area jamming, drone fine", note: "Gdańsk Bay", expect: "Area affected, drone was not" },
  { file: "flight-london-clean.csv", name: "Clean flight", note: "London", expect: "No evidence of interference: check pilot input and hardware" },
];

export const SENSOR_SAMPLES: DemoFile[] = [
  { file: "sensor-jamming-event.csv", name: "Jamming event", note: "A 10-minute jammer nearby", expect: "1 jamming event, High confidence" },
  { file: "sensor-spoofing-event.csv", name: "Spoofing event", note: "Fake signals drag the position north", expect: "1 spoofing event, High confidence" },
  { file: "sensor-jamming-then-spoofing.csv", name: "Two events", note: "Jamming, then spoofing 20 minutes later", expect: "2 events" },
  { file: "sensor-quiet-day.csv", name: "Quiet day", note: "Normal signals", expect: "No interference found" },
  { file: "sensor-blocked-view.csv", name: "Blocked view", note: "A lorry blocks part of the sky", expect: "No interference found (an obstruction isn't jamming)" },
];

export const FORMATS = {
  route: "lat, lon (one waypoint per row). Optional on the first row: planned_start (ISO time), event_venue (e.g. wembley).",
  flight: "t, lat, lon, alt_m, satellites, accuracy_m, fix_type, jamming_state*, spoofing_state* (one row per reading; * optional)",
  sensor: "time, fix, num_sv, h_acc_m, cno_top, sats_tracked, agc, jam_ind, jam_state, spoof_state, lat, lon (one row per second; only time and cno_top required)",
};
