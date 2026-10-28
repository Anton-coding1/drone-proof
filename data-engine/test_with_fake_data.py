"""
Self-test with FAKE data (no internet needed). Checks the collector's reading code and
the route risk engine give the expected answers. Run: python test_with_fake_data.py
Everything here is simulated - it never touches your real witnessmark.db.
"""
import datetime as dt, os, random, sqlite3, subprocess, sys

import h3

import collector as c
import route_risk as rr

DB = "test_fake.db"
random.seed(1)
AT = dt.datetime(2026, 10, 15, 12, tzinfo=dt.timezone.utc)
ok = True


def check(name, got, want):
    global ok
    good = got == want
    ok &= good
    print(f"  {'PASS' if good else 'FAIL'}  {name}: got {got}, expected {want}")


if os.path.exists(DB):
    os.remove(DB)
db = c.open_db(DB)
uk = [c.REGIONS["uk"]]

print("1. Reading Stanford-style files")
london_cell = h3.latlng_to_cell(51.50, -0.12, 4)
paris_cell = h3.latlng_to_cell(48.85, 2.35, 4)
fake_heatmap = [{"h3Index": london_cell, "lowQualityCount": 1, "totalAircraftCount": 40},
                {"h3Index": paris_cell, "lowQualityCount": 9, "totalAircraftCount": 30}]
rows = c.parse_hexes(fake_heatmap, "2026-10-14T10:00:00Z", uk)
check("keeps the London hexagon, drops Paris", len(rows), 1)
rows = c.parse_hexes({"cells": fake_heatmap}, "2026-10-14T10:00:00Z", uk)
check("also reads the dict-shaped file", len(rows), 1)
ev = c.parse_events([{"latitude": 52.0, "longitude": 0.5, "startTime": 1760000000000, "endTime": 1760003600000},
                     {"latitude": 30.0, "longitude": 30.0, "startTime": 1760000000, "endTime": 1760003600}],
                    "jamming", uk)
check("keeps UK event, drops Egypt event", len(ev), 1)
check("converts millisecond times", ev[0][4], "2025-10-09T08:53:20Z")

print("2. Building a fake 30-day history")
hexes = []
for day in range(30):
    for hour in range(0, 24, 2):
        t = (AT - dt.timedelta(days=day, hours=hour)).strftime("%Y-%m-%dT%H:00:00Z")
        # Central London: busy sky, almost never degraded
        for lat, lon in [(51.50, -0.12), (51.52, -0.05), (51.47, -0.20)]:
            hexes.append((f"ldn{lat}{lon}", t, lat, lon, random.choice([0, 0, 0, 1]), 40))
        # 'Testshire' (fake area in Kent): 30% degraded
        hexes.append(("kent", t, 51.20, 1.00, 12, 40))
        # Remote Highlands: almost no planes
        if day % 10 == 0 and hour == 0:
            hexes.append(("hlnd", t, 57.80, -5.10, 0, 2))
db.executemany("INSERT OR REPLACE INTO sky_hexes VALUES (?,?,?,?,?,?, 'FAKE', 'test')", hexes)
# one fake event near Norwich 3 days ago, one 20 days ago near Cambridge
db.executemany("INSERT INTO sky_events VALUES (?,?,?,?,?,?, 'FAKE', 'test')", [
    ("e1", "jamming", 52.63, 1.30, (AT - dt.timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), ""),
    ("e2", "jamming", 52.20, 0.12, (AT - dt.timedelta(days=20)).strftime("%Y-%m-%dT%H:%M:%SZ"), "")])
db.commit()

print("3. Route risk answers")
def level(lat, lon):
    return rr.assess(db, (lat, lon), AT, 30, 10.0)[:2]

check("Central London", level(51.50, -0.12), ("LOW", "High"))
check("Kent area with 30% degraded", level(51.20, 1.00), ("HIGH", "High"))
check("Highlands (too few planes)", level(57.80, -5.10)[0], "UNKNOWN")
check("Near Norwich (event 3 days ago)", level(52.63, 1.30)[0], "UNKNOWN")  # no hex data there
db.execute("INSERT INTO sky_hexes VALUES ('nor','2026-10-14T10:00:00Z',52.63,1.30,0,100,'FAKE','t')")
db.execute("INSERT INTO sky_hexes VALUES ('cam','2026-10-14T10:00:00Z',52.20,0.12,0,100,'FAKE','t')")
check("Near Norwich with planes + recent event", level(52.63, 1.30)[0], "HIGH")
check("Near Cambridge (older event only)", level(52.20, 0.12)[0], "ELEVATED")

secs = rr.split_route(rr.read_route("example_route.csv"), 1.0)
true_km = sum(rr.km_between(a, b) for a, b in zip(rr.read_route("example_route.csv"), rr.read_route("example_route.csv")[1:]))
check("Sections add up to the true route length (2.8 km)", round(sum(s[2] for s in secs), 1), round(true_km, 1))
check("Split into 3 sections", len(secs), 3)

print("4. Full command-line run on the example route")
r = subprocess.run([sys.executable, "route_risk.py", "example_route.csv", "--db", DB,
                    "--at", "2026-10-15T12:00"], capture_output=True, text=True)
print(r.stdout)
check("command ran", r.returncode, 0)

db.close()
os.remove(DB)
for f in ("example_route_risk.csv",):
    if os.path.exists(f):
        os.remove(f)
print("ALL TESTS PASSED" if ok else "SOME TESTS FAILED")
sys.exit(0 if ok else 1)
