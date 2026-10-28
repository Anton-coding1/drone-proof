"""
Witnessmark Route Risk Check v0.1 (the "forecaster")
Give it a drone route; it splits the route into sections and gives each one a
GPS-interference risk level, a reason and a confidence, using witnessmark.db.

  python route_risk.py example_route.csv
  python route_risk.py example_route.csv --days 30 --section-km 0.5
  python route_risk.py --points "51.4988,-0.1189 51.5034,-0.0870"

Route file: a CSV with columns lat,lon (one waypoint per row, in flying order).
Output: a table on screen + <route>_risk.csv

Method v0.1 (provisional, to be tuned on real data):
  Look at aircraft reports within RADIUS km of each section over the last DAYS days.
  UNKNOWN   fewer than 20 aircraft reports nearby
  HIGH      a jamming/spoofing event within 50 km in the last 7 days, or >= 20% of reports degraded
  ELEVATED  any such event within 50 km in the lookback window, or >= 5% degraded
  LOW       otherwise
  Confidence: High >= 500 reports, Medium >= 20, Low below that.
  Limitation: aircraft fly high and miss ground-level jammers. Ground sensors fix this.
"""
import argparse, csv, datetime as dt, math, sqlite3, sys
from pathlib import Path

METHOD = "Route Method v0.1"
ORDER = {"UNKNOWN": 0, "LOW": 1, "ELEVATED": 2, "HIGH": 3}
EVENT_KM = 50
LIMITATION = ("Based on aircraft data only. Ground-level jammers (police, events, vehicles) "
              "are usually invisible to aircraft; ground sensors are needed to see them.")


def km_between(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def read_route(path):
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows or "lat" not in rows[0] or "lon" not in rows[0]:
        sys.exit("Route file needs columns 'lat' and 'lon'.")
    return [(float(r["lat"]), float(r["lon"])) for r in rows]


def split_route(points, section_km):
    """Cut the route into sections of about section_km. Returns (start, end, length_km)."""
    if len(points) < 2:
        sys.exit("A route needs at least 2 points.")
    # walk along the line, dropping a cut every section_km
    dense = [points[0]]
    for a, b in zip(points, points[1:]):
        steps = max(1, math.ceil(km_between(a, b) / (section_km / 10)))
        for i in range(1, steps + 1):
            t = i / steps
            dense.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    sections, start, run = [], dense[0], 0.0
    for p, q in zip(dense, dense[1:]):
        run += km_between(p, q)
        if run >= section_km - 1e-9:
            sections.append((start, q, run))
            start, run = q, 0.0
    if run > 0.05 or not sections:
        sections.append((start, dense[-1], run))
    elif run > 0:  # tiny leftover: merge into the last section
        s, _, l = sections[-1]
        sections[-1] = (s, dense[-1], l + run)
    return sections


def assess(db, mid, at, days, radius_km):
    since = (at - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    until = at.strftime("%Y-%m-%dT%H:%M:%SZ")
    week = (at - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.1, math.cos(math.radians(mid[0]))))
    total = low = 0
    for lat, lon, lq, tot in db.execute(
            "SELECT lat, lon, low_quality_count, total_count FROM sky_hexes "
            "WHERE hour >= ? AND hour <= ? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
            (since, until, mid[0] - dlat, mid[0] + dlat, mid[1] - dlon, mid[1] + dlon)):
        if km_between(mid, (lat, lon)) <= radius_km:
            total += tot
            low += lq

    elat, elon = EVENT_KM / 111.0, EVENT_KM / (111.0 * max(0.1, math.cos(math.radians(mid[0]))))
    events = []
    for etype, lat, lon, start, end in db.execute(
            "SELECT type, lat, lon, start_time, end_time FROM sky_events "
            "WHERE start_time >= ? AND start_time <= ? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
            (since, until, mid[0] - elat, mid[0] + elat, mid[1] - elon, mid[1] + elon)):
        d = km_between(mid, (lat, lon))
        if d <= EVENT_KM:
            events.append((etype, start, d))
    recent = [e for e in events if e[1] >= week]

    share = low / total if total else 0.0
    if total < 20:
        level = "UNKNOWN"
    elif recent or share >= 0.20:
        level = "HIGH"
    elif events or share >= 0.05:
        level = "ELEVATED"
    else:
        level = "LOW"
    confidence = "High" if total >= 500 else "Medium" if total >= 20 else "Low"

    parts = [f"{total} aircraft reports within {radius_km:g} km in last {days} days"
             + (f", {share:.0%} degraded" if total else "")]
    if events:
        nearest = min(events, key=lambda e: e[2])
        parts.append(f"{len(events)} {'event' if len(events) == 1 else 'events'} within {EVENT_KM} km "
                     f"(nearest: {nearest[0]} {nearest[2]:.0f} km away, {nearest[1][:16].replace('T', ' ')} UTC)")
    else:
        parts.append(f"no recorded jamming/spoofing events within {EVENT_KM} km")
    if total < 20:
        parts.append("not enough aircraft data to judge")
    return level, confidence, "; ".join(parts), total, share, len(events)


def main():
    p = argparse.ArgumentParser(description="Witnessmark Route Risk Check")
    p.add_argument("route", nargs="?", help="CSV with lat,lon columns")
    p.add_argument("--points", help='inline route: "lat,lon lat,lon ..."')
    p.add_argument("--days", type=int, default=30, help="how far back to look (default 30)")
    p.add_argument("--radius-km", type=float, default=10.0, help="how far around each section to look")
    p.add_argument("--section-km", type=float, default=1.0, help="section length (default 1 km)")
    p.add_argument("--at", help="assess as if it were this time (YYYY-MM-DDTHH:MM), default now")
    p.add_argument("--db", default="witnessmark.db")
    a = p.parse_args()

    if a.points:
        pts = [tuple(map(float, x.split(","))) for x in a.points.split()]
        name = "route"
    elif a.route:
        pts, name = read_route(a.route), Path(a.route).stem
    else:
        sys.exit("Give a route file or --points.")
    if not Path(a.db).exists():
        sys.exit(f"No database at {a.db}. Run collector.py first.")
    at = (dt.datetime.strptime(a.at, "%Y-%m-%dT%H:%M").replace(tzinfo=dt.timezone.utc)
          if a.at else dt.datetime.now(dt.timezone.utc))

    db = sqlite3.connect(a.db)
    sections = split_route(pts, a.section_km)
    results = []
    for i, (s, e, length) in enumerate(sections, 1):
        mid = ((s[0] + e[0]) / 2, (s[1] + e[1]) / 2)
        level, conf, reason, total, share, nev = assess(db, mid, at, a.days, a.radius_km)
        results.append({"section": i, "start_lat": round(s[0], 5), "start_lon": round(s[1], 5),
                        "end_lat": round(e[0], 5), "end_lon": round(e[1], 5), "length_km": round(length, 2),
                        "risk": level, "confidence": conf, "aircraft_reports": total,
                        "degraded_share": round(share, 4), "events_nearby": nev, "reason": reason})

    worst = max(results, key=lambda r: ORDER[r["risk"]])["risk"]
    total_km = sum(r["length_km"] for r in results)
    print(f"\n{METHOD} | route '{name}' | {total_km:.1f} km in {len(results)} sections | "
          f"assessed at {at:%Y-%m-%d %H:%M} UTC, looking back {a.days} days\n")
    for r in results:
        print(f"  Section {r['section']:>2} ({r['length_km']:.1f} km): {r['risk']:<8} "
              f"confidence {r['confidence']:<6} | {r['reason']}")
    print(f"\n  OVERALL ROUTE RISK: {worst}")
    print(f"  Limitation: {LIMITATION}\n")

    out = f"{name}_risk.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0]))
        w.writeheader()
        w.writerows(results)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
