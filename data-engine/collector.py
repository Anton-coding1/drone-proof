"""
Witnessmark collector v0.1
Saves real aircraft GPS-interference data from Stanford GPS Lab (rfi.stanford.edu)
into your own database file (witnessmark.db), building up a history over time.

  python collector.py --backfill 2026/10/01 2026/10/14   fill in past days
  python collector.py --once                             grab today + yesterday, then stop
  python collector.py --loop                             keep running, check every hour
  python collector.py --export                           write CSVs for the Lovable Admin Import page
  python collector.py --stats                            show what's in the database

Needs: pip install requests h3
Licence: Stanford data is CC BY-NC 4.0. Fine for building and testing; you need
a licence from Stanford before selling anything built on it.
"""
import argparse, csv, datetime as dt, hashlib, os, sqlite3, sys, time

import h3
import requests

BASE = "https://waas-nas.stanford.edu/data"
REGIONS = {  # south, north, west, east
    "london": (50.8, 52.2, -1.6, 1.0),
    "uk": (49.8, 59.5, -8.5, 2.0),
    "baltic": (53.5, 61.0, 14.0, 30.0),
    "east_med": (31.0, 37.5, 26.0, 36.5),
}
SOURCE = "stanford_gps_lab"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sky_hexes (
    h3 TEXT NOT NULL, hour TEXT NOT NULL, lat REAL, lon REAL,
    low_quality_count INTEGER, total_count INTEGER,
    source TEXT, fetched_at TEXT,
    PRIMARY KEY (h3, hour, source));
CREATE INDEX IF NOT EXISTS idx_hex_hour ON sky_hexes(hour);
CREATE INDEX IF NOT EXISTS idx_hex_latlon ON sky_hexes(lat, lon);
CREATE TABLE IF NOT EXISTS sky_events (
    id TEXT PRIMARY KEY, type TEXT, lat REAL, lon REAL,
    start_time TEXT, end_time TEXT, source TEXT, fetched_at TEXT);
CREATE INDEX IF NOT EXISTS idx_event_start ON sky_events(start_time);
CREATE TABLE IF NOT EXISTS fetch_log (
    url TEXT PRIMARY KEY, status TEXT, rows INTEGER, fetched_at TEXT);
"""


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def open_db(path):
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    return db


def in_regions(lat, lon, boxes):
    return any(s <= lat <= n and w <= lon <= e for s, n, w, e in boxes)


def as_list(obj):
    """Stanford files are sometimes a list, sometimes a dict of lists. Flatten either."""
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        out = []
        for v in obj.values():
            out.extend(v if isinstance(v, list) else [v])
        return out
    return []


def to_iso(value):
    if value is None or value == "":
        return ""
    if isinstance(value, (int, float)) or str(value).replace(".", "", 1).isdigit():
        v = float(value)
        if v > 1e12:  # milliseconds
            v /= 1000
        return dt.datetime.fromtimestamp(v, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    s = str(value).replace(" ", "T")
    return s if s.endswith("Z") or "+" in s else s + "Z"


def parse_events(data, kind, boxes):
    rows = []
    for e in as_list(data):
        if not isinstance(e, dict):
            continue
        lat = e.get("latitude", e.get("lat"))
        lon = e.get("longitude", e.get("lon"))
        if lat is None or lon is None:
            continue
        lat, lon = float(lat), float(lon)
        if not in_regions(lat, lon, boxes):
            continue
        start, end = to_iso(e.get("startTime")), to_iso(e.get("endTime"))
        eid = hashlib.sha1(f"{kind}|{lat:.4f}|{lon:.4f}|{start}".encode()).hexdigest()[:16]
        rows.append((eid, kind, round(lat, 5), round(lon, 5), start, end))
    return rows


def parse_hexes(data, hour_iso, boxes):
    rows = []
    for c in as_list(data):
        if not isinstance(c, dict) or "h3Index" not in c:
            continue
        lat, lon = h3.cell_to_latlng(c["h3Index"])
        if not in_regions(lat, lon, boxes):
            continue
        rows.append((c["h3Index"], hour_iso, round(lat, 5), round(lon, 5),
                     int(c.get("lowQualityCount", 0)), int(c.get("totalAircraftCount", 0))))
    return rows


class Fetcher:
    def __init__(self, db, boxes):
        self.db, self.boxes = db, boxes
        self.http = requests.Session()
        self.http.headers["User-Agent"] = "witnessmark-collector/0.1 (student research)"
        self.errors_in_a_row = 0

    def already_done(self, url):
        r = self.db.execute("SELECT status FROM fetch_log WHERE url=?", (url,)).fetchone()
        return r is not None and r[0] in ("ok", "missing")

    def log(self, url, status, rows):
        self.db.execute("INSERT OR REPLACE INTO fetch_log VALUES (?,?,?,?)", (url, status, rows, now_iso()))

    def get_json(self, url):
        for attempt in range(3):
            try:
                r = self.http.get(url, timeout=60)
                if r.status_code == 404:
                    return None, "missing"
                r.raise_for_status()
                self.errors_in_a_row = 0
                return r.json(), "ok"
            except (requests.RequestException, ValueError) as e:
                if attempt == 2:
                    print(f"  ! could not fetch {url}: {type(e).__name__}")
                    self.errors_in_a_row += 1
                    if self.errors_in_a_row >= 3:
                        raise ConnectionError("Can't reach Stanford's server. Check your internet "
                                              "connection (some university Wi-Fi blocks it) and try again.")
                    return None, "error"
                time.sleep(3 * (attempt + 1))

    def fetch_day(self, day, force=False):
        """Fetch one day. force=True re-downloads even if done before (for today/yesterday,
        because Stanford keeps adding data for recent hours)."""
        d = day.strftime("%Y/%m/%d")
        new_events = new_hexes = 0
        for kind in ("jamming", "spoofing"):
            url = f"{BASE}/{kind}/{d}/events.json"
            if not force and self.already_done(url):
                continue
            data, status = self.get_json(url)
            rows = parse_events(data, kind, self.boxes) if data is not None else []
            self.db.executemany(
                "INSERT OR REPLACE INTO sky_events VALUES (?,?,?,?,?,?,?,?)",
                [r + (SOURCE, now_iso()) for r in rows])
            self.log(url, status, len(rows))
            new_events += len(rows)
        for hour in range(24):
            url = f"{BASE}/jamming/{d}/{hour:02}00/heatmap.json"
            if not force and self.already_done(url):
                continue
            data, status = self.get_json(url)
            hour_iso = dt.datetime(day.year, day.month, day.day, hour,
                                   tzinfo=dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            rows = parse_hexes(data, hour_iso, self.boxes) if data is not None else []
            self.db.executemany(
                "INSERT OR REPLACE INTO sky_hexes VALUES (?,?,?,?,?,?,?,?)",
                [r + (SOURCE, now_iso()) for r in rows])
            self.log(url, status, len(rows))
            new_hexes += len(rows)
        self.db.commit()
        print(f"{d}: {new_events} events, {new_hexes} area readings saved")


def dates_between(start, end):
    d0 = dt.datetime.strptime(start, "%Y/%m/%d").date()
    d1 = dt.datetime.strptime(end, "%Y/%m/%d").date()
    while d0 <= d1:
        yield d0
        d0 += dt.timedelta(days=1)


def recent_days():
    today = dt.datetime.now(dt.timezone.utc).date()
    return [today - dt.timedelta(days=1), today]


def export_csv(db, folder):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, "sky_events.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["type", "lat", "lon", "start_time", "end_time"])
        w.writerows(db.execute("SELECT type, lat, lon, start_time, end_time FROM sky_events ORDER BY start_time"))
    with open(os.path.join(folder, "sky_hexes.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["hour", "lat", "lon", "low_quality_count", "total_count"])
        w.writerows(db.execute("SELECT hour, lat, lon, low_quality_count, total_count FROM sky_hexes ORDER BY hour"))
    print(f"Wrote {folder}/sky_events.csv and {folder}/sky_hexes.csv (ready for the Admin Import page)")


def stats(db):
    h = db.execute("SELECT COUNT(*), MIN(hour), MAX(hour), SUM(total_count), SUM(low_quality_count) FROM sky_hexes").fetchone()
    e = db.execute("SELECT COUNT(*), MIN(start_time), MAX(start_time) FROM sky_events").fetchone()
    print(f"Area readings: {h[0]}  (from {h[1]} to {h[2]})")
    if h[3]:
        print(f"Aircraft reports: {h[3]}, of which degraded: {h[4]} ({100 * h[4] / h[3]:.1f}%)")
    print(f"Jamming/spoofing events: {e[0]}  (from {e[1]} to {e[2]})")


def main():
    p = argparse.ArgumentParser(description="Witnessmark data collector")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--backfill", nargs=2, metavar=("START", "END"), help="dates as YYYY/MM/DD")
    g.add_argument("--once", action="store_true", help="fetch today and yesterday, then stop")
    g.add_argument("--loop", action="store_true", help="fetch every hour until you press Ctrl+C")
    g.add_argument("--export", action="store_true", help="write CSVs for the Lovable import page")
    g.add_argument("--stats", action="store_true", help="show what's in the database")
    p.add_argument("--regions", nargs="+", default=["uk"], choices=sorted(REGIONS))
    p.add_argument("--db", default="witnessmark.db")
    a = p.parse_args()

    db = open_db(a.db)
    if a.stats:
        return stats(db)
    if a.export:
        return export_csv(db, "export")

    f = Fetcher(db, [REGIONS[r] for r in a.regions])
    if a.backfill:
        for day in dates_between(*a.backfill):
            f.fetch_day(day)
    elif a.once:
        for day in recent_days():
            f.fetch_day(day, force=True)
    elif a.loop:
        print("Collecting every hour. Leave this window open. Press Ctrl+C to stop.")
        while True:
            try:
                for day in recent_days():
                    f.fetch_day(day, force=True)
            except Exception as e:  # never let one bad hour kill the loop
                print("  ! error this round:", e)
            time.sleep(3600)
    stats(db)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nStopped. Your data is saved in the database.")
    except ConnectionError as e:
        sys.exit(f"\n{e}\nAnything already downloaded is saved.")
