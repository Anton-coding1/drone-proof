#!/usr/bin/env python3
"""Writes the website's demo data files (all SIMULATED) into ../public/demo-data/.

Flight logs are placed at the times and places of the simulated aircraft data already in
the demo database, so the second witness (aircraft overhead) has something to say.
Sensor logs come from:  python witnessmark_sensor.py simulate --scenario ... --csv ...
"""
import csv, datetime as dt, math, os, random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "demo-data")
FLIGHT_COLS = ["t", "lat", "lon", "alt_m", "satellites", "accuracy_m", "fix_type", "jamming_state", "spoofing_state"]


def flight(name, start, lat0, lon0, seconds=300, bad=lambda s, rnd: None, seed=1):
    rnd = random.Random(seed)
    t0 = dt.datetime.fromisoformat(start.replace("Z", "+00:00"))
    rows = []
    for s in range(seconds):
        lat = lat0 + 0.0015 * math.sin(s / 48)
        lon = lon0 + 0.0025 * math.sin(s / 96)
        r = dict(t=(t0 + dt.timedelta(seconds=s)).strftime("%Y-%m-%dT%H:%M:%SZ"), lat=lat, lon=lon,
                 alt_m=60 + 10 * math.sin(s / 30), satellites=16 + rnd.randint(0, 3), accuracy_m=0.8 + rnd.random() * 0.6,
                 fix_type=3, jamming_state=1, spoofing_state=1)
        r.update(bad(s, rnd) or {})
        rows.append(r)
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(FLIGHT_COLS)
        for r in rows:
            w.writerow([r["t"], f"{r['lat']:.6f}", f"{r['lon']:.6f}", f"{r['alt_m']:.1f}", r["satellites"], f"{r['accuracy_m']:.2f}",
                        r["fix_type"], r["jamming_state"], r["spoofing_state"]])


def jammed(a, b):
    def f(s, rnd):
        if a <= s <= b:
            return dict(satellites=3 + rnd.randint(0, 3), accuracy_m=20 + rnd.random() * 25, fix_type=2, jamming_state=3)
    return f


def spoofed(s, rnd):
    if s >= 120:
        drift = (s - 120) * 0.00012  # about 13 m per second: faster than the drone can fly
        return dict(lat=51.5007 + drift, spoofing_state=3 if s >= 125 else 1, satellites=18, accuracy_m=0.9)


def write_route(name, points, start=None, venue=None):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.writer(f)
        head = ["lat", "lon"] + (["planned_start"] if start else []) + (["event_venue"] if venue else [])
        w.writerow(head)
        for i, (la, lo) in enumerate(points):
            w.writerow([la, lo] + ([start if i == 0 else ""] if start else []) + ([venue if i == 0 else ""] if venue else []))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    # Incident evidence: one log for each box of the 2x2 finding table.
    flight("flight-london-clean.csv", "2026-10-01T14:00:00Z", 51.5007, -0.1246)
    flight("flight-london-spoofed.csv", "2026-10-01T14:10:00Z", 51.5007, -0.1246, bad=spoofed, seed=2)
    flight("flight-tromso-local-jammer.csv", "2026-09-16T10:00:00Z", 69.29, 16.03, bad=jammed(120, 239), seed=3)
    flight("flight-gdansk-area-jamming.csv", "2026-09-20T15:00:00Z", 54.38, 18.47, bad=jammed(60, 299), seed=4)
    flight("flight-gdansk-drone-unaffected.csv", "2026-09-20T15:20:00Z", 54.38, 18.47, seed=5)
    # Pre-flight check routes (lat, lon; optional planned_start and event_venue on the first row).
    write_route("route-greenwich-park.csv", [(51.477, -0.001), (51.48, 0.005)], start="2026-10-01T15:00:00Z")
    write_route("route-london-hospitals.csv", [(51.4988, -0.1189), (51.5065, -0.11), (51.508, -0.098), (51.5034, -0.087)], start="2026-10-01T15:00:00Z")
    write_route("route-wembley-match-day.csv", [(51.545, -0.305), (51.556, -0.29), (51.564, -0.265)], start="2026-10-01T15:00:00Z", venue="wembley")
    write_route("route-oxfordshire-survey.csv", [(51.7, -1.3), (51.712, -1.27), (51.724, -1.245)], start="2026-10-01T15:00:00Z")
    write_route("route-gdansk-bay.csv", [(54.36, 18.42), (54.38, 18.47), (54.4, 18.53)], start="2026-09-20T15:30:00Z")
    print("Demo data written to", os.path.abspath(OUT))
