Witnessmark demo data - ALL FILES ARE SIMULATED, not real measurements.
Every file comes as CSV and as Excel (.xlsx); both give the same result.
Easiest: drop any of them on the "Try it" page and Witnessmark works out what it is.

PRE-FLIGHT CHECK  (upload on Pre-flight check > "Upload a route")
  route-greenwich-park.csv       -> GO
  route-london-hospitals.csv     -> CAUTION (over very busy ground even a small chance is above the strict limit)
  route-medical-heathrow.csv     -> NO-GO (enters the Heathrow flight restriction zone; tick "I have permission" to see the GPS result)
  route-wembley-match-day.csv    -> CAUTION (sets an event at Wembley Stadium)
  route-oxfordshire-survey.csv   -> CAUTION (no aircraft data nearby: thin data is never GO over people)
  route-gdansk-bay.csv           -> NO-GO (start time inside a simulated jamming event)
  Format: lat,lon per row; optional planned_start and event_venue on the first row.
  Results shown are with the default drone settings.

INCIDENT EVIDENCE  (upload on Incident evidence > "Upload a flight log")
  flight-crash-gps-jamming.csv       -> Consistent with external GPS interference (jammed, drifted, crashed)
  flight-gdansk-area-jamming.csv     -> Consistent with external GPS interference
  flight-tromso-local-jammer.csv     -> Consistent with local GPS interference
  flight-london-spoofed.csv          -> Consistent with local GPS interference
  flight-gdansk-drone-unaffected.csv -> Area affected, drone was not
  flight-london-clean.csv            -> No evidence of interference
  Format: t,lat,lon,alt_m,satellites,accuracy_m,fix_type,jamming_state,spoofing_state
