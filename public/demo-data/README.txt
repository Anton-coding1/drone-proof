Witnessmark demo data - ALL FILES ARE SIMULATED, not real measurements.

PRE-FLIGHT CHECK  (upload on Pre-flight check > "Upload a route")
  route-greenwich-park.csv       -> GO
  route-london-hospitals.csv     -> NO-GO (small chance per section adds up over very dense ground)
  route-wembley-match-day.csv    -> CAUTION (sets an event at Wembley Stadium)
  route-oxfordshire-survey.csv   -> CAUTION (no aircraft data nearby: thin data is never GO over people)
  route-gdansk-bay.csv           -> NO-GO (start time inside a simulated jamming event)
  Format: lat,lon per row; optional planned_start and event_venue on the first row.
  Results shown are with the default drone settings.

INCIDENT EVIDENCE  (upload on Incident evidence > "Upload a flight log")
  flight-gdansk-area-jamming.csv     -> Consistent with external GPS interference
  flight-tromso-local-jammer.csv     -> Consistent with local GPS interference
  flight-london-spoofed.csv          -> Consistent with local GPS interference
  flight-gdansk-drone-unaffected.csv -> Area affected, drone was not
  flight-london-clean.csv            -> No evidence of interference
  Format: t,lat,lon,alt_m,satellites,accuracy_m,fix_type,jamming_state,spoofing_state

SITE MONITORING  (upload on Site monitoring)
  sensor-jamming-event.csv          -> 1 jamming event, High confidence
  sensor-spoofing-event.csv         -> 1 spoofing event, High confidence
  sensor-jamming-then-spoofing.csv  -> 2 events
  sensor-quiet-day.csv              -> No interference found
  sensor-blocked-view.csv           -> No interference found
  Format: time,fix,num_sv,h_acc_m,cno_top,sats_tracked,agc,jam_ind,jam_state,spoof_state,lat,lon
