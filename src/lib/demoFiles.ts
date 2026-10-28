/** Simulated sample files served from /public/demo-data, one set per feature. */
export type DemoFile = { file: string; name: string; note: string; expect: string };

export const ROUTE_SAMPLES: DemoFile[] = [
  { file: "route-greenwich-park.csv", name: "Greenwich Park hop", note: "Short urban flight with plenty of clean aircraft data", expect: "GO" },
  { file: "route-london-hospitals.csv", name: "Central London hospital link", note: "Densely populated ground", expect: "CAUTION: over very busy ground even a small chance is above the strict limit" },
  { file: "route-medical-heathrow.csv", name: "Medical delivery past Heathrow", note: "Hillingdon Hospital to West Middlesex Hospital", expect: "NO-GO: enters the Heathrow flight restriction zone. Tick that you have permission to see the GPS result" },
  { file: "route-wembley-match-day.csv", name: "Wembley on match day", note: "Sets an event at Wembley Stadium", expect: "CAUTION: an event at the stadium raises the risk" },
  { file: "route-oxfordshire-survey.csv", name: "Oxfordshire field survey", note: "No aircraft data nearby", expect: "CAUTION: thin data is never GO over people" },
  { file: "route-gdansk-bay.csv", name: "Gdańsk Bay", note: "Sets the start time inside a simulated jamming event", expect: "NO-GO" },
];

export const FLIGHT_SAMPLES: DemoFile[] = [
  { file: "flight-crash-gps-jamming.csv", name: "Crash after jamming", note: "Gdańsk port; jammed at 2 min, crashes at 3 min", expect: "Consistent with external GPS interference (High confidence)" },
  { file: "flight-gdansk-area-jamming.csv", name: "Area jamming, drone affected", note: "Gdańsk Bay", expect: "Consistent with external GPS interference" },
  { file: "flight-tromso-local-jammer.csv", name: "Local jammer", note: "Tromsø; aircraft overhead saw nothing", expect: "Consistent with local GPS interference" },
  { file: "flight-london-spoofed.csv", name: "Spoofed position", note: "London; the receiver flags spoofing and the position jumps", expect: "Consistent with local GPS interference" },
  { file: "flight-gdansk-drone-unaffected.csv", name: "Area jamming, drone fine", note: "Gdańsk Bay", expect: "Area affected, drone was not" },
  { file: "flight-london-clean.csv", name: "Clean flight", note: "London", expect: "No evidence of interference: check pilot input and hardware" },
];


export const FORMATS = {
  route: "lat, lon (one waypoint per row). Optional on the first row: planned_start (ISO time), event_venue (e.g. wembley).",
  flight: "t, lat, lon, alt_m, satellites, accuracy_m, fix_type, jamming_state*, spoofing_state* (one row per reading; * optional)",
};
